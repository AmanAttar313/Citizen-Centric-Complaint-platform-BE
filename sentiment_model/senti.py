import joblib

model = joblib.load("priority_model.pkl")


complaint = "No drinking water available"

prediction = model.predict([complaint])

print(prediction[0])