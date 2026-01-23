# Kisan Help Website - Installation Guide

## Prerequisites
- Python installed (Download from python.org)
- Internet connection (for Google Text-to-Speech)

## Steps to Run

1. **Open Terminal/Command Prompt**
   Go to the project folder:
   ```sh
   cd d:\Projects\kisan_help
   ```

2. **Install Libraries**
   Run the following command to install Django, scikit-learn, etc.:
   ```sh
   pip install -r requirements.txt
   ```

3. **Run Migrations** (Create Database)
   ```sh
   python manage.py makemigrations
   python manage.py migrate
   ```

4. **Load Data & Train Model**
   Load the sample dataset and train the ML model:
   ```sh
   python manage.py load_data
   ```

4. **Start Server**
   ```sh
   python manage.py runserver
   ```

5. **Open in Browser**
   - Open Chrome (Edge also works, but Chrome is best for voice).
   - Go to: http://127.0.0.1:8000/
   - Allow Microphone permission when asked.

## Admin & Training
- Go to `/admin/` (Create superuser first: `python manage.py createsuperuser`).
- You can add more questions in "Training Data".
- Select questions and choose "Retrain ML Model" action to update the logic.
3. Speak your query (e.g., "Crop", "Mausam", "Fertilizer").
4. Wait for processing.
5. Listen to the answer!
