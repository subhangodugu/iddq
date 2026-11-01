"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Database,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Trash2,
  Eye,
  RefreshCw,
  FolderInput,
  FileCode,
  X,
  Plus
} from "lucide-react";
import {
  fetchDatasets,
  fetchReadiness,
  loadSampleDatasets,
  importSourceFolder,
  uploadDatasetFile,
  fetchDatasetPreview,
  fetchUploadHistory,
  deleteDataset
} from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { Dialog } from "@/components/ui/Dialog";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Preview state
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; filename: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [ds, rd, hist] = await Promise.all([
        fetchDatasets(1),
        fetchReadiness(1),
        fetchUploadHistory(1)
      ]);
      setDatasets(ds || []);
      setReadiness(rd);
      setHistory(hist || []);
    } catch (e: any) {
      setActionMsg({ text: `Failed to load: ${e.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (![".csv", ".py", ".md"].includes(ext)) {
      setActionMsg({ text: "Supported file formats: .CSV, .PY, and .MD", type: "error" });
      return;
    }
    setUploading(true);
    setActionMsg({ text: `Uploading and validating ${file.name}...`, type: "info" });
    try {
      const res = await uploadDatasetFile(file, 1);
      setActionMsg({
        text: `Successfully uploaded ${file.name} (${(res.row_count || 0).toLocaleString()} ${ext === ".csv" ? "rows" : "lines"} validated)`,
        type: "success"
      });
      loadAll();
    } catch (e: any) {
      setActionMsg({ text: `Upload failed: ${e.message}`, type: "error" });
    } finally {
      setUploading(false);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }

  async function handleLoadSample() {
    setActionMsg({ text: "Ingesting benchmark dataset files from data/sample...", type: "info" });
    try {
      await loadSampleDatasets(1);
      setActionMsg({ text: "Supplied benchmark files ingested and registered successfully!", type: "success" });
      loadAll();
    } catch (e: any) {
      setActionMsg({ text: `Error: ${e.message}`, type: "error" });
    }
  }

  async function handleImportSourceFolder() {
    setActionMsg({ text: "Scanning & importing from 'Test Engineering Solutions/AI OPtimized IDDQ/Dataset/iddq_synthetic_dataset'...", type: "info" });
    try {
      const res = await importSourceFolder();
      setActionMsg({ text: `Successfully imported ${res.imported_count} files (${res.files?.join(", ")}) from source directory!`, type: "success" });
      loadAll();
    } catch (e: any) {
      setActionMsg({ text: `Import failed: ${e.message}`, type: "error" });
    }
  }

  async function handlePreview(datasetId: number) {
    setPreviewLoading(true);
    try {
      const p = await fetchDatasetPreview(datasetId);
      setPreviewData(p);
    } catch (e: any) {
      setActionMsg({ text: `Preview failed: ${e.message}`, type: "error" });
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleDelete(datasetId: number, filename: string) {
    setPendingDelete({ id: datasetId, filename });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDataset(pendingDelete.id);
      setActionMsg({ text: `Removed dataset ${pendingDelete.filename}`, type: "info" });
      setPendingDelete(null);
      loadAll();
    } catch (e: any) {
      setActionMsg({ text: `Delete failed: ${e.message}`, type: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <Dialog
        open={Boolean(pendingDelete)}
        danger
        title="Remove this dataset?"
        description={pendingDelete ? `${pendingDelete.filename} will be deleted from the project.` : undefined}
        confirmLabel="Remove dataset"
        loading={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
      {/* Page Header */}
      <PageHeader
        title="Dataset Ingestion & Quality Traceability"
        subtitle="Immutable file storage, schema validation, join referential integrity, and analysis readiness scoring."
        icon={Database}
        badge={
          <StatusBadge
            status={readiness?.readiness_score === 100 ? "pass" : "warning"}
            label={`Readiness: ${readiness?.readiness_score ?? (datasets.length > 0 ? 100 : 0)}%`}
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              icon={FolderInput}
              onClick={handleImportSourceFolder}
              title="Import all 6 files directly from Test Engineering Solutions folder"
            >
              Import Source Folder
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Database}
              onClick={handleLoadSample}
            >
              Load Benchmark
            </Button>
          </div>
        }
      />

      {/* Action Notification */}
      {actionMsg && (
        <div
          className={`flex items-center justify-between rounded-xl border p-3.5 text-sm ${
            actionMsg.type === "success"
              ? "bg-silicon-emerald/10 border-silicon-emerald/30 text-silicon-emerald"
              : actionMsg.type === "error"
              ? "bg-silicon-ruby/10 border-silicon-ruby/30 text-silicon-ruby"
              : "bg-silicon-cyan/10 border-silicon-cyan/30 text-silicon-cyan"
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionMsg.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {actionMsg.type === "error" && <XCircle className="w-4 h-4 shrink-0" />}
            {actionMsg.type === "info" && <RefreshCw className="w-4 h-4 animate-spin shrink-0" />}
            <span>{actionMsg.text}</span>
          </div>
          <button onClick={() => setActionMsg(null)} className="p-1 text-app-muted hover:text-app-text" aria-label="Dismiss message">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Drag & Drop File Upload Zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-silicon-cyan bg-silicon-cyan/10 shadow-glow-cyan"
            : "border-app-border bg-app-card hover:border-silicon-cyan/60 hover:bg-app-cardHover"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.py,.md"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />
        <div className="flex flex-col items-center justify-center space-y-3.5">
          <div className="p-3.5 bg-app-cardHover rounded-2xl text-silicon-cyan border border-app-border shadow-sm">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div>
            <div className="text-sm font-bold text-app-text">
              {uploading ? "Uploading & Validating File..." : "Drop semiconductor files (.CSV, .PY, .MD) here or click to browse"}
            </div>
            <div className="text-xs text-app-muted mt-1 max-w-xl mx-auto leading-relaxed">
              Supports dataset CSVs (<span className="text-silicon-cyan font-semibold">iddq_die_data.csv</span>,{" "}
              <span className="text-silicon-cyan font-semibold">iddq_transients.csv</span>,{" "}
              <span className="text-silicon-cyan font-semibold">vector_info.csv</span>,{" "}
              <span className="text-silicon-cyan font-semibold">vector_fault_matrix.csv</span>) and companion artifacts (
              <span className="text-silicon-amber font-semibold">generate_iddq_dataset.py</span>,{" "}
              <span className="text-silicon-amber font-semibold">README.md</span>).
            </div>
          </div>
          <div className="text-[11px] text-app-subtle">
            Automatic schema detection, SHA-256 provenance hash calculation, null & duplicate row screening.
          </div>
        </div>
      </div>

      {/* Data Readiness Scorecard */}
      <Card>
        <CardHeader>
          <div>
            <div className="text-[10px] uppercase font-bold text-app-muted">Data Foundation Readiness</div>
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-3xl font-bold text-app-text">
                {readiness?.readiness_score ?? (datasets.length > 0 ? 100 : 0)}%
              </span>
              <StatusBadge
                status={readiness?.readiness_score === 100 ? "pass" : "warning"}
                label={readiness?.status_label ?? (datasets.length > 0 ? "Production Ready" : "Awaiting Ingestion")}
              />
            </div>
          </div>
          <div className="text-xs text-app-muted max-w-md text-right hidden sm:block">
            {readiness?.readiness_score === 100 || datasets.length >= 4
              ? "All required CSV formats validated. Full multi-lever optimization unlocked."
              : "Some optimization modules blocked until required datasets are uploaded."}
          </div>
        </CardHeader>

        {/* Readiness Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {readiness?.checklist?.map((item: any, i: number) => {
            const isReady = item.status === "READY";
            return (
              <div
                key={i}
                className={`p-4 rounded-xl border text-xs ${
                  isReady
                    ? "bg-silicon-emerald/5 border-silicon-emerald/30 text-app-text"
                    : "bg-app-cardHover/60 border-app-border text-app-muted"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-app-text truncate">{item.name}</span>
                  {isReady ? (
                    <CheckCircle2 className="w-4 h-4 text-silicon-emerald shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-silicon-ruby shrink-0" />
                  )}
                </div>
                <div className="text-[11px] text-app-muted mb-2">
                  Enables: {item.required_for?.join(", ")}
                </div>
                <div className="text-[10px] uppercase font-bold text-silicon-cyan">
                  Weight: {item.weight}%
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Dataset Inventory & Provenance Table */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              <FileText className="w-4 h-4 text-silicon-cyan" />
              <span>Active Datasets & Ingestion Provenance</span>
            </CardTitle>
            <CardDescription>
              Chronological log of verified semiconductor datasets and SHA-256 provenance checksums
            </CardDescription>
          </div>
          <span className="text-xs text-app-muted">
            Total active: <strong className="text-app-text">{datasets.length}</strong>
          </span>
        </CardHeader>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-app-border text-app-muted font-semibold uppercase text-[11px]">
                <th className="pb-3 px-3">Dataset Type</th>
                <th className="pb-3 px-3">Filename</th>
                <th className="pb-3 px-3 text-right">Rows / Lines</th>
                <th className="pb-3 px-3 text-right">Size</th>
                <th className="pb-3 px-3">SHA-256 Checksum</th>
                <th className="pb-3 px-3 text-center">Status</th>
                <th className="pb-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/60">
              {datasets.map((d) => (
                <tr key={d.id} className="hover:bg-app-cardHover/60 transition-colors">
                  <td className="py-3 px-3 text-silicon-cyan font-bold uppercase">{d.file_type}</td>
                  <td className="py-3 px-3 text-app-text font-medium">{d.filename}</td>
                  <td className="py-3 px-3 text-right text-app-muted">
                    {(d.row_count || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-app-muted">
                    {((d.file_size_bytes || 0) / (1024 * 1024)).toFixed(2)} MB
                  </td>
                  <td className="py-3 px-3 text-app-subtle text-[11px] truncate max-w-xs" title={d.checksum_sha256}>
                    {d.checksum_sha256}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <StatusBadge status="pass" label={d.status} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center space-x-1.5">
                      <button
                        onClick={() => handlePreview(d.id)}
                        className="rounded-lg bg-app-cardHover p-1.5 text-app-muted hover:bg-silicon-cyan hover:text-[rgb(var(--on-accent))]"
                        title="Preview dataset columns and statistics"
                        aria-label="Preview dataset"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(d.id, d.filename)}
                        className="rounded-lg bg-app-cardHover p-1.5 text-app-muted hover:bg-silicon-ruby hover:text-[rgb(var(--on-accent))]"
                        title="Delete dataset"
                        aria-label={`Delete ${d.filename}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {datasets.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <EmptyState
                      title="No Datasets Uploaded"
                      description="Upload semiconductor CSV files above or click 'Import Source Folder' to load benchmark data."
                      icon={Database}
                      actionLabel="Import Source Folder"
                      onAction={handleImportSourceFolder}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dataset Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-app-card border border-app-border rounded-2xl max-w-5xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="p-4 border-b border-app-border flex items-center justify-between bg-app-cardHover/40">
              <div>
                <h3 className="text-sm font-bold text-app-text flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-silicon-cyan" />
                  <span>Dataset Preview: {previewData.filename}</span>
                </h3>
                <p className="text-[11px] text-app-muted mt-0.5">
                  Type: <span className="font-bold text-silicon-cyan uppercase">{previewData.file_type}</span> | Total Rows:{" "}
                  <span className="text-app-text font-bold">{previewData.total_rows?.toLocaleString()}</span> | Sample Duplicates:{" "}
                  <span className="text-app-text font-bold">{previewData.duplicate_rows_sample}</span>
                </p>
              </div>
              <button
                onClick={() => setPreviewData(null)}
                className="text-app-muted hover:text-app-text p-1.5 rounded-lg hover:bg-app-cardHover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {previewData.preview_columns?.length === 1 && previewData.preview_columns[0] === "Line" ? (
                <div className="bg-app-bg border border-app-border rounded-xl p-4 text-[11px] text-app-text max-h-[60vh] overflow-y-auto">
                  <div className="text-xs uppercase text-silicon-cyan font-bold mb-3 flex items-center space-x-2">
                    <FileCode className="w-4 h-4" />
                    <span>Source / Specification Content Preview</span>
                  </div>
                  <div className="space-y-0.5">
                    {previewData.preview_rows?.map((row: any, idx: number) => (
                      <div key={idx} className="flex hover:bg-app-cardHover/50 py-0.5">
                        <span className="w-12 select-none text-app-subtle text-right pr-4 shrink-0">{idx + 1}</span>
                        <span className="text-app-text whitespace-pre overflow-x-auto">{row.Line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Missing Value Analysis Bar */}
                  <div>
                    <div className="text-xs uppercase text-app-muted font-bold mb-2">Column Data Types & Missing Values</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {previewData.preview_columns?.map((col: string) => {
                        const missingPct = previewData.missing_percentages?.[col] || 0;
                        const dtype = previewData.column_types?.[col] || "object";
                        return (
                          <div key={col} className="p-2.5 rounded-xl bg-app-cardHover border border-app-border">
                            <div className="text-app-text truncate font-bold text-[11px]" title={col}>
                              {col}
                            </div>
                            <div className="text-[10px] text-app-muted flex items-center justify-between mt-1">
                              <span className="text-silicon-cyan font-semibold">{dtype}</span>
                              <span className={missingPct > 0 ? "text-silicon-ruby font-bold" : "text-silicon-emerald font-bold"}>
                                {missingPct}% null
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sample Rows Table */}
                  <div>
                    <div className="text-xs uppercase text-app-muted font-bold mb-2">
                      Sample Data Rows (Top {previewData.preview_rows?.length || 0})
                    </div>
                    <div className="overflow-x-auto border border-app-border rounded-xl">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-app-cardHover border-b border-app-border text-app-muted">
                          <tr>
                            {previewData.preview_columns?.slice(0, 10).map((col: string) => (
                              <th key={col} className="p-2.5 whitespace-nowrap font-semibold">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border/60">
                          {previewData.preview_rows?.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-app-cardHover/50">
                              {previewData.preview_columns?.slice(0, 10).map((col: string) => (
                                <td key={col} className="p-2.5 text-app-text whitespace-nowrap">
                                  {String(row[col] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-app-border flex justify-end bg-app-cardHover/30">
              <Button variant="secondary" size="sm" onClick={() => setPreviewData(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
