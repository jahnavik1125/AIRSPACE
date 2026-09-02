import logging

logger = logging.getLogger("airspace-models")

try:
  import torch
  import torch.nn as nn
  TORCH_AVAILABLE = True
except ImportError:
  TORCH_AVAILABLE = False
  torch = None
  nn = None

# ==============================================================================
# PyTorch Trajectory Recognition Sequence Network
# ==============================================================================

if TORCH_AVAILABLE and nn is not None:
  class AirWritingNet(nn.Module):
    """
    1D Temporal CNN + Bidirectional GRU network mapping resampled coordinate
    trajectories (N=50 points, 8 features) to 36 classification target logits.
    """
    def __init__(self, num_classes: int = 36, input_dim: int = 8, hidden_dim: int = 64, num_layers: int = 2):
      super(AirWritingNet, self).__init__()
      
      # 1. 1D Temporal CNN Layer to capture local spatial-geometric shapes
      self.conv1 = nn.Conv1d(
        in_channels=input_dim,
        out_channels=hidden_dim,
        kernel_size=3,
        padding=1
      )
      self.relu = nn.ReLU()
      self.pool = nn.MaxPool1d(kernel_size=2)  # Resamples sequence length from 50 to 25
      
      # 2. Bidirectional Gated Recurrent Unit (BiGRU) to capture writing strokes sequence flow
      self.gru = nn.GRU(
        input_size=hidden_dim,
        hidden_size=hidden_dim,
        num_layers=num_layers,
        batch_first=True,
        bidirectional=True
      )
      
      # 3. Dense Fully Connected Layer (output maps to A-Z, 0-9)
      # Bidirectional GRU output is twice the hidden dimension
      self.fc = nn.Linear(hidden_dim * 2, num_classes)

    def forward(self, x):
      # Input x shape: (Batch, SequenceLength=50, Features=8)
      # PyTorch Conv1d expects shape: (Batch, Channels=Features, SequenceLength)
      x = x.transpose(1, 2)
      
      x = self.conv1(x)
      x = self.relu(x)
      x = self.pool(x)
      
      # Reshape back for GRU sequence processing: (Batch, SequenceLength=25, HiddenDim)
      x = x.transpose(1, 2)
      
      # GRU Output: (Batch, SequenceLength, HiddenDim * 2)
      gru_out, _ = self.gru(x)
      
      # Global max pooling over sequence length to get static feature maps
      pooled, _ = torch.max(gru_out, dim=1)
      
      # Logits shape: (Batch, Classes=36)
      logits = self.fc(pooled)
      return logits
else:
  # Fallback model definition to prevent import crashes
  class AirWritingNet:
    def __init__(self, *args, **kwargs):
      logger.warning("PyTorch model class declared but PyTorch is not installed in the environment.")
