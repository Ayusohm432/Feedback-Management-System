import os
import sys
import django
from dotenv import load_dotenv
from django.conf import settings

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kisan_project.settings')
django.setup()

from kisan_app.ml_engine import predict_answer

def test_openai_integration():
    print("Testing OpenAI integration via GitHub Models...")
    
    query = "What is the best time to sow wheat in Punjab?"
    print(f"\nQuery: {query}")
    
    try:
        answer = predict_answer(query)
        print(f"\nAnswer:\n{answer}")
        
        if "Error" in answer:
            print("\n[FAIL] Verification Failed")
        else:
            print("\n[PASS] Verification Passed")
            
    except Exception as e:
        print(f"\n[FAIL] Exception occurred: {e}")

if __name__ == "__main__":
    test_openai_integration()
