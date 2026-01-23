import os
import django
import sys

# Setup Django environment
# Ensure the project root is in python path
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kisan_project.settings')
django.setup()

from kisan_app.ml_engine import predict_answer

def test_prediction():
    print("Testing Gemini Integration...")
    queries = [
        "What is the best time to plant wheat?",
        "Tell me about weather tomorrow."
    ]
    
    for q in queries:
        print(f"\nQuery: {q}")
        try:
            answer = predict_answer(q)
            print(f"Answer: {repr(answer)}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_prediction()
