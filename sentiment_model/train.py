import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.metrics import accuracy_score


# LOAD DATASET
df = pd.read_csv("updated_complaints_with_priority.csv")


# FEATURES
X = df["complaint_text"]


# LABELS
y = df["priority"]


# SPLIT DATA
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)


# CREATE PIPELINE
model = Pipeline([

    # Convert text to numbers
    ("tfidf", TfidfVectorizer(
        stop_words='english',
        ngram_range=(1,2)
    )),

    # ML Algorithm
    ("classifier", LogisticRegression())
])


# TRAIN MODEL
model.fit(X_train, y_train)


# TEST MODEL
predictions = model.predict(X_test)


# ACCURACY
accuracy = accuracy_score(y_test, predictions)

print("Accuracy:", accuracy)


# DETAILED REPORT
print(classification_report(y_test, predictions))


# SAVE MODEL
joblib.dump(model, "priority_model.pkl")

print("Model Saved Successfully")