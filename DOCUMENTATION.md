# Smart Gate Access System Documentation

## Table of Contents
1. [Business Value of RFID Card Payment](#1-business-value-of-rfid-card-payment)
2. [RFID Technology & Frequency](#2-rfid-technology--frequency)
3. [Main Components & Functions](#3-main-components--functions)
4. [Correct SPI Pinout (RC522 to ESP32)](#4-correct-spi-pinout-rc522-to-esp32)
5. [Arduino IDE Configuration](#5-arduino-ide-configuration)
6. [Minimalist Test Script (UID Reader)](#6-minimalist-test-script-uid-reader)
7. [Physical Testing Guide](#7-physical-testing-guide)
8. [Project Folder Structure](#8-project-folder-structure)
9. [Architecture & Design](#9-architecture--design)
10. [Application Screenshots](#10-application-screenshots)

---

## 1. Business Value of RFID Card Payment
Using RFID cards for gate access and payment offers a seamless, fast, and secure experience. 
* **Speed:** Tapping an RFID card takes less than a second, significantly reducing queues at toll gates, parking lots, or public transport.
* **Convenience:** Users do not need to carry cash or wait for change.
* **Tracking & Data:** Businesses can easily track transaction history, monitor user behavior, and manage balances in real-time.
* **Cost-Effective:** RFID cards and readers are relatively inexpensive to deploy and maintain compared to complex biometric or ticket-printing systems.

## 2. RFID Technology & Frequency
**RFID (Radio Frequency Identification)** uses electromagnetic fields to automatically identify and track tags attached to objects.
* **Frequency:** The RC522 module operates at **13.56 MHz** (High Frequency - HF).
* **Tags:** It supports standard MIFARE tags (like the white card or blue keychain tag usually included). These tags have a unique ID (UID) and small memory blocks to store data.
* **Operation:** The reader generates a magnetic field. When the passive tag enters this field, it powers up via induction and transmits its UID back to the reader.

## 3. Main Components & Functions
1. **ESP32 (Microcontroller):** The brain of the system. It processes the RFID data, connects to WiFi, and communicates with the backend API.
2. **RFID RC522 Module:** Reads the UID from the physical card.
3. **Servo Motor (MG996R/SG90):** Acts as the physical gate barrier. It opens when a payment is successful.
4. **Node.js Backend:** Handles API requests (`/pay`, `/confirm`), checks balances, deducts amounts, and saves transaction records.
5. **PostgreSQL Database:** Stores user data, card balances, and transaction history.
6. **Frontend Web App:** A user interface to check card balances and view transaction history.

## 4. Correct SPI Pinout (RC522 to ESP32)

> **CRITICAL NOTE:** The RFID module's **3.3V** pin must be connected strictly to the **3V3** pin on the ESP32. Do not connect it to 5V. 
> The **RST** pin must be connected to **D22**. In earlier testing, swapped pins caused the ESP32 to fail reading the module, resulting in a firmware version `0x0` error.

| RC522 Pin | ESP32 Pin | Note |
| :--- | :--- | :--- |
| **SDA (SS)** | D5 | SPI Chip Select |
| **SCK** | D18 | SPI Clock |
| **MOSI** | D23 | SPI Master Out Slave In |
| **MISO** | D19 | SPI Master In Slave Out |
| **IRQ** | - | Not Connected |
| **GND** | GND | Ground |
| **RST** | D22 | Reset Pin |
| **3.3V** | 3V3 | **MUST be 3.3V!** |

![Diagram Pin ESP32 to RC522](/d:/mygithub-research/iot/iot-rfid-access-card/design/diagram-pin-esp32-to-rc522.png)
![Microcontroller Mapping Pin](/d:/mygithub-research/iot/iot-rfid-access-card/ss/9-microcontroller-mapping-pin.png)

## 5. Arduino IDE Configuration
To ensure the code compiles and runs perfectly, configure your Arduino IDE as follows:

1. **Install MFRC522 Library:** 
   Go to **Library Manager**, search for `MFRC522` by *GithubCommunity (Miguel Balboa)*, and install it.
   ![Install MFRC522](/d:/mygithub-research/iot/iot-rfid-access-card/ss/10-ardunio-install-lib-mfrc522.png)
2. **Install ESP32Servo Library:**
   Install `ESP32Servo` for servo control.
   ![Install ESP32Servo](/d:/mygithub-research/iot/iot-rfid-access-card/ss/11-ardunio-install-lib-eps32servo.png)
3. **Select Board:**
   Go to **Tools > Board** and select **DOIT ESP32 DEVKIT V1** or **ESP32 Dev Module**.
   ![Choose ESP32 Board](/d:/mygithub-research/iot/iot-rfid-access-card/ss/12-microcontroller-chose-module-board-esp32.png)
4. **Compile and Upload:**
   Ensure the correct COM port is selected and upload the code.
   ![Compile & Upload](/d:/mygithub-research/iot/iot-rfid-access-card/ss/12-microcontroller-compile-and-upload-to-esp32.png)
5. **Serial Monitor:**
   Open the Serial Monitor and set the baud rate to **115200**.
   ![Serial Monitor](/d:/mygithub-research/iot/iot-rfid-access-card/ss/12-microcontroller-open-serial-monitor.png)

## 6. Minimalist Test Script (UID Reader)
Use this minimal script to test if your RFID wiring is correct. This script disables WiFi to ensure stable reading and forces the antenna to turn on for maximum sensitivity.

```cpp
#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 5
#define RST_PIN 22

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
    Serial.begin(115200);
    SPI.begin();
    mfrc522.PCD_Init();
    
    // Force antenna on to increase sensitivity
    mfrc522.PCD_AntennaOn(); 

    Serial.println("Scan your RFID Card...");
}

void loop() {
    if (!mfrc522.PICC_IsNewCardPresent()) return;
    if (!mfrc522.PICC_ReadCardSerial()) return;

    String cardId = "";
    for (byte i = 0; i < mfrc522.uid.size; i++) {
        cardId += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
        cardId += String(mfrc522.uid.uidByte[i], HEX);
    }
    cardId.toUpperCase();
    
    Serial.println("Card UID: " + cardId);
    mfrc522.PICC_HaltA();
    delay(1000);
}
```

## 7. Physical Testing Guide
* **Card Placement:** Some RC522 modules have weak antenna sensitivity. When testing, make sure to place the white card **flat and directly touching the physical PCB** of the RC522 module.
* **Avoid Metal:** Do not place the RFID module on a metal surface, as it will disrupt the electromagnetic field.
* **Visual Confirmation:** 
  ![No Card](/d:/mygithub-research/iot/iot-rfid-access-card/ss/13-microcontroller-check-no-card.png)
  ![Type RFID Card](/d:/mygithub-research/iot/iot-rfid-access-card/ss/14-microcontroller-type-rfid-card-key.png)

## 8. Project Folder Structure
```text
/
├── backend/            # Node.js Express server handling API requests
│   ├── src/            # Source code (index.js, db.js)
│   ├── package.json    # Backend dependencies
│   └── Dockerfile      # Docker instructions for backend
├── db/                 # Database initialization scripts (.sql)
├── design/             # System architecture diagrams and pinouts
├── frontend/           # HTML/JS/CSS for user dashboard
│   ├── index.html      # Main UI
│   ├── script.js       # API calls to backend
│   └── nginx.conf      # Reverse proxy configuration
├── iot/                # C++ source code for ESP32 Microcontroller
│   └── main/main.ino   # Main IoT logic
├── ss/                 # Screenshots of progress and testing
└── docker-compose.yml  # Container orchestration
```

## 9. Architecture & Design
**System Architecture:**
![Architecture Design](/d:/mygithub-research/iot/iot-rfid-access-card/design/architecture.png)

**Sequence Diagram:**
![Sequence Diagram](/d:/mygithub-research/iot/iot-rfid-access-card/design/diagram-sequence.png)

## 10. Application Screenshots

**Docker Compose Running:**
![Docker Compose](/d:/mygithub-research/iot/iot-rfid-access-card/ss/2-docker-compose.png)

**Database & ERD:**
![Database ERD](/d:/mygithub-research/iot/iot-rfid-access-card/ss/3-database-and-erd.png)

**API Payment Request:**
![API Payment](/d:/mygithub-research/iot/iot-rfid-access-card/ss/4-api-payment.png)

**API Confirm Request:**
![API Confirm](/d:/mygithub-research/iot/iot-rfid-access-card/ss/5-api-confirm-apabila-di-perlukan-cofirm-pembayaran.png)

**API History Transaction:**
![API History](/d:/mygithub-research/iot/iot-rfid-access-card/ss/6-api-history-transaction.png)

**Database Table Save Transaction:**
![Table Transaction](/d:/mygithub-research/iot/iot-rfid-access-card/ss/7-database-table-save-transaction.png)

**Frontend History & Saldo:**
![Frontend Dashboard](/d:/mygithub-research/iot/iot-rfid-access-card/ss/8-frontend-history-saldo.png)

**Microcontroller Testing Unregistered Card:**
![Unregistered Card](/d:/mygithub-research/iot/iot-rfid-access-card/ss/15-microcontroller-no-card-save-in-database.png)

**Microcontroller Final Payment Process:**
![Final Payment](/d:/mygithub-research/iot/iot-rfid-access-card/ss/16-microcontroller-finaly-payment-rifd.png)
