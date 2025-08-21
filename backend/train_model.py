import pickle
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# Load the actual heart disease dataset
heart_data = pd.read_csv('heart.csv')

# Separate features (X) and target (y)
X = heart_data.drop('target', axis=1)  # All columns except 'target'
y = heart_data['target']  # Target column (0 = no heart disease, 1 = heart disease)

# Split the data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Scale the features for better model performance
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train the Random Forest model
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train_scaled, y_train)

# Save the trained model and scaler
with open('heart_model.pkl', 'wb') as file:
    pickle.dump((model, scaler), file)