"""
OceanView 4D: Local CPU Training & Forecast Script for ConvLSTM
Trains a Convolutional LSTM model to forecast 3D ocean state (Temp, Salinity, Currents)
5 days into the future based on the past sequence.
Outputs an ONNX model and generates the forecast JSON cache for the backend.
"""

import os
import json
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np

EPOCHS = 50
BATCH_SIZE = 4
LEARNING_RATE = 0.001
ONNX_EXPORT_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "convlstm_forecast.onnx")
FORECAST_OUTPUT = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "forecast_5d.json")

# A simplified ConvLSTM cell proxy for the prototype
class SimpleConvLSTM(nn.Module):
    def __init__(self, in_channels, hidden_channels):
        super(SimpleConvLSTM, self).__init__()
        self.conv = nn.Conv2d(in_channels + hidden_channels, hidden_channels, kernel_size=3, padding=1)
        self.tanh = nn.Tanh()
        self.sigmoid = nn.Sigmoid()

    def forward(self, x, hidden):
        combined = torch.cat([x, hidden], dim=1)
        gates = self.conv(combined)
        # Simplified gating for mock purposes
        return self.tanh(gates)

class ForecastNet(nn.Module):
    def __init__(self):
        super(ForecastNet, self).__init__()
        # Input: 20 channels (Temp/Salinity at 10 depths)
        self.rnn = SimpleConvLSTM(20, 32)
        self.out = nn.Conv2d(32, 20, kernel_size=3, padding=1)

    def forward(self, x):
        # x shape: [batch, seq_len, channels, lat, lon]
        batch_size, seq_len, _, lat, lon = x.shape
        hidden = torch.zeros(batch_size, 32, lat, lon, device=x.device)
        
        for t in range(seq_len):
            hidden = self.rnn(x[:, t, :, :, :], hidden)
            
        prediction = self.out(hidden)
        return prediction

def load_sequence_data():
    # Mocking sequential tensor data for CPU training
    # Shape: [batch, seq_len, channels, lat, lon]
    # Grid: lat(6..24) -> 37 points, lon(68..97) -> 59 points
    seq_len = 3  # Past 3 days
    channels = 20 # 10 depths * 2 variables
    
    X = np.random.randn(20, seq_len, channels, 37, 59).astype(np.float32)
    # Output: forecast for next day
    Y = np.random.randn(20, channels, 37, 59).astype(np.float32)
    return X, Y

def train_and_forecast():
    print("Initializing ConvLSTM for CPU training...")
    os.makedirs(os.path.dirname(ONNX_EXPORT_PATH), exist_ok=True)
    
    X_train, y_train = load_sequence_data()
    dataset = torch.utils.data.TensorDataset(torch.tensor(X_train), torch.tensor(y_train))
    dataloader = torch.utils.data.DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    model = ForecastNet()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    criterion = nn.MSELoss()
    
    print(f"Starting training on CPU for {EPOCHS} epochs...")
    print("Estimated time on standard laptop CPU: ~10-15 minutes.")
    
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
    dummy_input = torch.randn(1, 3, 20, 37, 59)
    torch.onnx.export(model, dummy_input, ONNX_EXPORT_PATH, 
                      input_names=['input'], output_names=['output'],
                      dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}})
    print(f"ONNX model saved to {ONNX_EXPORT_PATH}")
    
    # Generate static forecast cache for backend
    print("Generating 5-day forecast cache...")
    forecast_data = {
        "status": "forecast_ready",
        "metadata": {
            "forecast_days": 5,
            "region": "India EEZ"
        },
        "forecast": "Not fully populated in mock script, meant for ONNX inference."
    }
    with open(FORECAST_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(forecast_data, f)
    print(f"Forecast cache saved to {FORECAST_OUTPUT}")

if __name__ == "__main__":
    train_and_forecast()
