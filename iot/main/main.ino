#include <Arduino.h>
/**
 * IoT Smart Gate Access System - ESP32 Code
 * Hardware: ESP32, RFID RC522, Servo MG996R/SG90, Buzzer
 * 
 * Flow:
 * 1. Read RFID Tag
 * 2. Generate Idempotency Key (DeviceID + CardID + Millis)
 * 3. POST /api/pay
 * 4. If Success -> Open Servo -> POST /api/confirm
 * 5. Handle Offline/Failed cards with Buffer
 */

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// --- CONFIGURATION ---
const char* ssid = "PutriTunggal";
const char* password = "uu311009";
const char* serverUrl = "http://192.168.100.35:3000/api"; // Replace with your backend IP
const char* deviceId = "GATE_01";
const int merchantId = 1;
const float gateFee = 2000.00;

// Pins
#define SS_PIN 5
#define RST_PIN 22
#define SERVO_PIN 13

MFRC522 mfrc522(SS_PIN, RST_PIN);
Servo gateServo;

// Failed Transactions Buffer (Circular Buffer for 5 items)
struct FailedTx {
    String cardId;
    String idempotencyKey;
};
FailedTx failedBuffer[5];
int bufferIndex = 0;
int bufferCount = 0;

// Function Prototypes (Needed for CPP)
void processPayment(String cardId, String idempotencyKey);
void confirmPayment(String idempotencyKey);
void openGate();
void saveToBuffer(String cardId, String idempotencyKey);

void setup() {
    Serial.begin(115200);
    SPI.begin();
    mfrc522.PCD_Init();
    
    gateServo.attach(SERVO_PIN);
    gateServo.write(0); // Close gate

    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi Connected");

    // Check RFID Module
    byte v = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
    Serial.print("MFRC522 Software Version: 0x");
    Serial.print(v, HEX);
    if (v == 0x91) Serial.println(" (v1.0 detected)");
    else if (v == 0x92) Serial.println(" (v2.0 detected)");
    else Serial.println(" (unknown or not detected)");
}

void loop() {
    // Check if new card present
    if (!mfrc522.PICC_IsNewCardPresent()) return;
    if (!mfrc522.PICC_ReadCardSerial()) return;

    // Get Card ID (UID)
    String cardId = "";
    for (byte i = 0; i < mfrc522.uid.size; i++) {
        cardId += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
        cardId += String(mfrc522.uid.uidByte[i], HEX);
    }
    cardId.toUpperCase();
    
    Serial.println("\n--------------------------");
    Serial.println("KARTU TERDETEKSI!");
    Serial.println("UID: " + cardId);
    Serial.println("--------------------------");

    // 1. Process Payment
    String idempotencyKey = String(deviceId) + "_" + cardId + "_" + String(millis());
    processPayment(cardId, idempotencyKey);

    mfrc522.PICC_HaltA();
}

void processPayment(String cardId, String idempotencyKey) {
    if (WiFi.status() != WL_CONNECTED) {
        saveToBuffer(cardId, idempotencyKey);
        Serial.println("Offline! Saved to buffer.");
        return;
    }

    HTTPClient http;
    http.begin(String(serverUrl) + "/pay");
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["card_id"] = cardId;
    doc["merchant_id"] = merchantId;
    doc["amount"] = gateFee;
    doc["idempotency_key"] = idempotencyKey;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0) {
        String response = http.getString();
        StaticJsonDocument<200> resDoc;
        deserializeJson(resDoc, response);

        if (resDoc["status"] == "SUCCESS") {
            // int txId = resDoc["transaction_id"];
            Serial.println("Payment Success");
            
            // 2. Open Gate
            openGate();

            // 3. Confirm Success no longer needed
            // confirmPayment(idempotencyKey);
        } else {
            Serial.println("Payment Failed: " + String((const char*)resDoc["error"]));
        }
    } else {
        Serial.println("Error on sending POST: " + String(httpResponseCode));
        saveToBuffer(cardId, idempotencyKey);
    }
    http.end();
}

void confirmPayment(String idempotencyKey) {
    HTTPClient http;
    http.begin(String(serverUrl) + "/confirm");
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<128> doc;
    doc["idempotency_key"] = idempotencyKey;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode == 200) {
        Serial.println("Gate Status: SUCCESS confirmed by server.");
    }
    http.end();
}

void openGate() {
    Serial.println("Opening Gate...");
    gateServo.write(90); // Open horizontal
    delay(3000);        // Keep open for 3 seconds
    gateServo.write(0);  // Close
    Serial.println("Gate Closed.");
}

void saveToBuffer(String cardId, String idempotencyKey) {
    failedBuffer[bufferIndex].cardId = cardId;
    failedBuffer[bufferIndex].idempotencyKey = idempotencyKey;
    bufferIndex = (bufferIndex + 1) % 5;
    if (bufferCount < 5) bufferCount++;
}
