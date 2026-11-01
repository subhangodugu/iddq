from typing import Dict, Any, List, Tuple, Optional
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import classification_report, confusion_matrix
from backend.iddq.defect_detection.classifier import DEFECT_FEATURE_COLS
from backend.iddq.features.leakage_guard import verify_no_leakage

CLASSES = ["none", "bridge", "gate_oxide_short", "open_floating", "latent_weak"]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}
IDX_TO_CLASS = {i: c for i, c in enumerate(CLASSES)}

def train_taxonomy_classifier(
    df: pd.DataFrame,
    save_path: Optional[str] = None
) -> Tuple[Any, Dict[str, Any]]:
    """
    Trains a multiclass classifier for physical defect taxonomy:
    ['none', 'bridge', 'gate_oxide_short', 'open_floating', 'latent_weak'].
    Trained strictly on train lots, evaluated on validation and test lots.
    """
    if "defect_type" not in df.columns:
        raise ValueError("defect_type column missing from dataset.")
        
    feature_cols = [c for c in DEFECT_FEATURE_COLS if c in df.columns]
    verify_no_leakage(feature_cols)
    
    is_train = (df["suggested_split"] == "train").to_numpy() if "suggested_split" in df.columns else np.ones(len(df), dtype=bool)
    is_val = (df["suggested_split"] == "validation").to_numpy() if "suggested_split" in df.columns else np.zeros(len(df), dtype=bool)
    is_test = (df["suggested_split"] == "test").to_numpy() if "suggested_split" in df.columns else np.zeros(len(df), dtype=bool)
    
    X = df[feature_cols].to_numpy()
    y_raw = df["defect_type"].fillna("none").to_numpy()
    y = np.array([CLASS_TO_IDX.get(d, 0) for d in y_raw])
    
    X_train, y_train = X[is_train], y[is_train]
    X_val, y_val = X[is_val], y[is_val]
    X_test, y_test = X[is_test], y[is_test]
    
    model = HistGradientBoostingClassifier(
        max_iter=150,
        class_weight="balanced",
        random_state=42,
        min_samples_leaf=15
    )
    model.fit(X_train, y_train)
    
    # Evaluate on test split
    y_pred_test = model.predict(X_test)
    y_prob_test = model.predict_proba(X_test)
    
    cm = confusion_matrix(y_test, y_pred_test, labels=list(range(len(CLASSES))))
    
    per_class_metrics = {}
    for i, cname in enumerate(CLASSES):
        total_actual = int(np.sum(y_test == i))
        correct = int(cm[i, i])
        rec = round(correct / max(1, total_actual), 4)
        prec = round(correct / max(1, int(np.sum(y_pred_test == i))), 4)
        per_class_metrics[cname] = {
            "support": total_actual,
            "predicted": int(np.sum(y_pred_test == i)),
            "true_positive": correct,
            "recall": rec,
            "precision": prec
        }
        
    metadata = {
        "model_type": "defect_taxonomy_multiclass",
        "classes": CLASSES,
        "classes_mapping": CLASS_TO_IDX,
        "features_used": feature_cols,
        "confusion_matrix": cm.tolist(),
        "test_per_class_metrics": per_class_metrics,
        "disclaimer": "Defect taxonomy classifications represent engineering hypotheses based on electrical signature patterns, not physical destruction/SEM confirmation."
    }
    
    if save_path:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        joblib.dump({"model": model, "metadata": metadata}, save_path)
        
    return model, metadata

def predict_taxonomy(model: Any, df: pd.DataFrame, feature_cols: List[str]) -> Tuple[List[str], np.ndarray]:
    """Returns predicted class label and confidence probability for each row."""
    X = df[feature_cols].to_numpy()
    probs = model.predict_proba(X)
    pred_indices = np.argmax(probs, axis=1)
    confidences = np.max(probs, axis=1)
    labels = [IDX_TO_CLASS.get(idx, "none") for idx in pred_indices]
    return labels, confidences
