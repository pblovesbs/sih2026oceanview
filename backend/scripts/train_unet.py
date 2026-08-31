"""
OceanView 4D: Local CPU Training Script for U-Net
Trains a U-Net model to reconstruct 3D subsurface temperature and salinity structures 
from 2D surface variables (sea surface height, sea surface winds) across the India EEZ.
Outputs an ONNX model.
"""

import os
import json
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np

EPOCHS = 100
BATCH_SIZE = 8
LEARNING_RATE = 0.001
ONNX_EXPORT_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "unet_india_eez.onnx")

# A simplified 2D/3D mapping network (proxy for a full U-Net for this prototype)
# Maps a 2D spatial grid of surface variables -> 3D spatial grid of subsurface variables
class SimpleUNet(nn.Module):
    def __init__(self, in_channels=3, out_channels=20):
        super(SimpleUNet, self).__init__()
        # in_channels: SSH, Wind_U, Wind_V
        # out_channels: Temp/Salinity at 10 depth levels (2 * 10 = 20)
        
        # Simple Encoder-Decoder structure
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU()
        )
        
        self.decoder = nn.Sequential(
            nn.Upsample(scale_factor=2, mode='bilinear', align_corners=False),
            nn.Conv2d(32, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv2d(16, out_channels, kernel_size=3, padding=1)
        )

    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded

def load_training_data():
    cmems_path = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "cmems_india_eez.json")
    argo_path = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "india_eez_4d.json")
    
    # In a real scenario, this would align CMEMS surface data with Argo subsurface interpolations
    # For now, we generate dummy tensor data that matches the grid shapes
    # Grid: lat(6..24) -> 37 points, lon(68..97) -> 59 points
    num_samples = 5 # 5 time steps
    
    # Input: [samples, channels (SSH, u, v), lat, lon]
    X = np.random.randn(num_samples, 3, 37, 59).astype(np.float32)
    # Output: [samples, channels (10 depths * 2 vars), lat, lon]
    Y = np.random.randn(num_samples, 20, 37, 59).astype(np.float32)
    
    return X, Y

def train_model():
    print("Initializing U-Net for CPU training...")
    os.makedirs(os.path.dirname(ONNX_EXPORT_PATH), exist_ok=True)
    
    X_train, y_train = load_training_data()
    
    dataset = torch.utils.data.TensorDataset(torch.tensor(X_train), torch.tensor(y_train))
    dataloader = torch.utils.data.DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    model = SimpleUNet()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    criterion = nn.MSELoss()
    
    print(f"Starting training on CPU for {EPOCHS} epochs...")
    print("Estimated time on standard laptop CPU: ~5-10 minutes.")
    
    model.train()
    for epoch in range(EPOCHS):
        total_loss = 0
        for batch_x, batch_y in dataloader:
            optimizer.zero_grad()
            preds = model(batch_x)
            loss = criterion(preds, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            
        if (epoch + 1) % 10 == 0:
            print(f"Epoch [{epoch+1}/{EPOCHS}] Loss: {total_loss/len(dataloader):.4f}")
            
    print("Training complete. Exporting to ONNX...")
    model.eval()
    dummy_input = torch.randn(1, 3, 37, 59)
    torch.onnx.export(model, dummy_input, ONNX_EXPORT_PATH, 
                      input_names=['input'], output_names=['output'],
                      dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}})
    print(f"ONNX model saved to {ONNX_EXPORT_PATH}")

if __name__ == "__main__":
    train_model()
