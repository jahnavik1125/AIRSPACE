import os
import json
import logging
from datetime import datetime

try:
  import torch
  import torch.nn as nn
  import torch.optim as optim
  from torch.utils.data import DataLoader, random_split
  from ai_core.airwriting.dataset import AirWritingDataset, CLASSES
  from ai_core.airwriting.models import AirWritingNet
  TORCH_AVAILABLE = True
except ImportError:
  TORCH_AVAILABLE = False
  torch = None

logger = logging.getLogger("airspace-train")
logging.basicConfig(level=logging.INFO)

def train_model(data_dir: str = "datasets/air-writing/raw", model_dir: str = "packages/ai/ai_core/airwriting/weights"):
  """
  Loads the custom training dataset, executes split calculations, trains the
  AirWritingNet BiGRU model, and saves weights and version history.
  """
  if not TORCH_AVAILABLE:
    print("[ERROR] PyTorch is not installed in this environment. Cannot run neural training pipeline.")
    return False

  dataset = AirWritingDataset(data_dir=data_dir)
  if len(dataset) < 10:
    print(f"\n[INSUFFICIENT DATA] Only {len(dataset)} samples found in '{data_dir}'.")
    print("Training the custom PyTorch model requires at least 10 spatial coordinates samples.")
    print("Please use the dataset collection studio (/air-write/collect) to gather handwriting samples first.\n")
    return False

  # 1. Split datasets: 70% Train, 15% Validation, 15% Test
  train_len = int(len(dataset) * 0.70)
  val_len = int(len(dataset) * 0.15)
  test_len = len(dataset) - train_len - val_len
  
  train_set, val_set, test_set = random_split(
    dataset, 
    [train_len, val_len, test_len],
    generator=torch.Generator().manual_seed(42)  # Deterministic splits seeding
  )

  train_loader = DataLoader(train_set, batch_size=8, shuffle=True)
  val_loader = DataLoader(val_set, batch_size=8, shuffle=False)

  # 2. Instantiate sequence model
  device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
  model = AirWritingNet(num_classes=len(CLASSES)).to(device)
  criterion = nn.CrossEntropyLoss()
  optimizer = optim.Adam(model.parameters(), lr=0.001)

  print(f"Starting training on {device} (train={train_len}, val={val_len}, test={test_len})...")

  epochs = 15
  best_val_acc = 0.0
  
  for epoch in range(epochs):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    
    for inputs, labels in train_loader:
      inputs, labels = inputs.to(device), labels.to(device)
      optimizer.zero_grad()
      
      outputs = model(inputs)
      loss = criterion(outputs, labels)
      loss.backward()
      optimizer.step()
      
      running_loss += loss.item() * inputs.size(0)
      _, predicted = torch.max(outputs, 1)
      total += labels.size(0)
      correct += (predicted == labels).sum().item()

    train_loss = running_loss / train_len
    train_acc = correct / total

    # Validation audit
    model.eval()
    val_loss = 0.0
    val_correct = 0
    val_total = 0
    with torch.no_grad():
      for inputs, labels in val_loader:
        inputs, labels = inputs.to(device), labels.to(device)
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        val_loss += loss.item() * inputs.size(0)
        _, predicted = torch.max(outputs, 1)
        val_total += labels.size(0)
        val_correct += (predicted == labels).sum().item()
        
    val_loss = val_loss / val_len
    val_acc = val_correct / val_total

    print(f"Epoch {epoch+1:02d}/{epochs:02d} | Train Loss: {train_loss:.4f} Acc: {train_acc:.2%} | Val Loss: {val_loss:.4f} Acc: {val_acc:.2%}")

    # Checkpoint saving if best accuracy improves
    if val_acc >= best_val_acc:
      best_val_acc = val_acc
      os.makedirs(model_dir, exist_ok=True)
      
      # Save weights file
      weights_path = os.path.join(model_dir, "airwriting_latest.pt")
      torch.save(model.state_dict(), weights_path)
      
      # Save model version metadata
      metadata = {
        "model_version": "1.0.0",
        "training_date": datetime.now().isoformat(),
        "dataset_version": "v1-collected",
        "total_samples": len(dataset),
        "val_accuracy": val_acc,
        "classes": CLASSES
      }
      with open(os.path.join(model_dir, "model_meta.json"), "w") as f:
        json.dump(metadata, f, indent=2)

  print(f"[SUCCESS] Training complete. Best Validation Accuracy: {best_val_acc:.2%}")
  return True

if __name__ == "__main__":
  train_model()
