import os
import json
import logging
import numpy as np

try:
  import torch
  from torch.utils.data import DataLoader, random_split
  from ai_core.airwriting.dataset import AirWritingDataset, CLASSES, CHAR_TO_IDX
  from ai_core.airwriting.models import AirWritingNet
  TORCH_AVAILABLE = True
except ImportError:
  TORCH_AVAILABLE = False
  torch = None

logger = logging.getLogger("airspace-eval")

def evaluate_model(data_dir: str = "datasets/air-writing/raw", model_path: str = "packages/ai/ai_core/airwriting/weights/airwriting_latest.pt"):
  """
  Loads weights, runs inference on test split, and reports Macro Accuracy/Precision/Recall/F1
  and confusion matrix diagnostics.
  """
  if not TORCH_AVAILABLE:
    print("[ERROR] PyTorch is not available. Cannot run evaluation.")
    return

  if not os.path.exists(model_path):
    print(f"[ERROR] Trained weights file '{model_path}' not found. Train model first.")
    return

  dataset = AirWritingDataset(data_dir=data_dir)
  if len(dataset) < 10:
    print("Insufficient dataset size to compile evaluation metrics.")
    return

  # Use the same random split seed to get the exact same test partition
  train_len = int(len(dataset) * 0.70)
  val_len = int(len(dataset) * 0.15)
  test_len = len(dataset) - train_len - val_len
  
  _, _, test_set = random_split(
    dataset, 
    [train_len, val_len, test_set_len := test_len],
    generator=torch.Generator().manual_seed(42)
  )

  test_loader = DataLoader(test_set, batch_size=8, shuffle=False)
  
  # Load model
  device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
  model = AirWritingNet(num_classes=len(CLASSES)).to(device)
  model.load_state_dict(torch.load(model_path, map_location=device))
  model.eval()

  all_preds = []
  all_targets = []

  with torch.no_grad():
    for inputs, labels in test_loader:
      inputs = inputs.to(device)
      outputs = model(inputs)
      _, predicted = torch.max(outputs, 1)
      all_preds.extend(predicted.cpu().numpy())
      all_targets.extend(labels.numpy())

  y_true = np.array(all_targets)
  y_pred = np.array(all_preds)

  # Calculate metrics
  correct = (y_true == y_pred).sum()
  accuracy = correct / len(y_true)

  # Compile Confusion Matrix (36 x 36)
  num_classes = len(CLASSES)
  cm = np.zeros((num_classes, num_classes), dtype=int)
  for t, p in zip(y_true, y_pred):
    cm[t, p] += 1

  # Compute macro-averaging precision, recall, f1
  precisions = []
  recalls = []
  f1_scores = []
  
  for i in range(num_classes):
    tp = cm[i, i]
    fp = cm[:, i].sum() - tp
    fn = cm[i, :].sum() - tp
    
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * (prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
    
    precisions.append(prec)
    recalls.append(rec)
    f1_scores.append(f1)

  macro_precision = np.mean(precisions)
  macro_recall = np.mean(recalls)
  macro_f1 = np.mean(f1_scores)

  print("\n=================================================")
  print("        AIR WRITE NEURAL MODEL EVALUATION")
  print("=================================================")
  print(f"Test Samples: {len(y_true)}")
  print(f"Accuracy:     {accuracy:.2%}")
  print(f"Precision:    {macro_precision:.4f}")
  print(f"Recall:       {macro_recall:.4f}")
  print(f"Macro F1:     {macro_f1:.4f}")
  print("=================================================\n")

  # Write metrics summary log file
  output_dir = os.path.dirname(model_path)
  report = {
    "test_accuracy": float(accuracy),
    "macro_precision": float(macro_precision),
    "macro_recall": float(macro_recall),
    "macro_f1": float(macro_f1),
    "confusion_matrix": cm.tolist()
  }
  with open(os.path.join(output_dir, "eval_report.json"), "w") as f:
    json.dump(report, f, indent=2)

if __name__ == "__main__":
  evaluate_model()
