#!/bin/bash
# OceanView 4D: Background Scheduler for Forecasting
# Adds a daily cron job to run the ConvLSTM training/forecasting script.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PYTHON_EXEC="python3" # Or point to venv if needed
CRON_JOB="0 2 * * * cd $SCRIPT_DIR && $PYTHON_EXEC train_convlstm.py >> ../../logs/forecast.log 2>&1"

# Check if cron job already exists
(crontab -l 2>/dev/null | grep -F "$CRON_JOB") &>/dev/null
if [ $? -eq 0 ]; then
    echo "Forecast cron job already exists."
else
    echo "Adding forecast cron job to run daily at 2:00 AM..."
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Done."
fi
