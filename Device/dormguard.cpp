#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_NeoPixel.h>

// ================= WIFI =================
const char* ssid = "your wifi name";
const char* password = "your wifi password";

// ================= GOOGLE SHEET =================
const char* googleScriptURL =
"google sheet api for door logging";

// ================= CONTROL API =================
const char* ctrlsScriptURL =
"google sheets api for device controls";

// ================= PINS =================
#define IR_PIN     34
#define PIR_PIN    19
#define BUZZER_PIN 27
#define LED_PIN_1  32
#define LED_PIN_2  25
#define LED_COUNT  8

Adafruit_NeoPixel strip1(LED_COUNT, LED_PIN_1, NEO_GRB + NEO_KHZ800);
Adafruit_NeoPixel strip2(LED_COUNT, LED_PIN_2, NEO_GRB + NEO_KHZ800);

portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

// ================= STATES =================
bool doorOpen      = false;
bool lastDoorState = false;
bool lastDoorRaw   = false;
unsigned long doorDebounceTime = 0;

bool motionDetected  = false;
bool lastMotionState = false;
bool lastMotionRaw   = false;
unsigned long motionDebounceTime = 0;

#define DEBOUNCE_MS 50

bool alertActive     = false;
bool lastAlertActive = false;
bool alertSuppressed = false;
bool beepState       = false;

bool lampOn              = false;
unsigned long lampOffTime = 0;

unsigned long doorOpenTime   = 0;
unsigned long alertStartTime = 0;
unsigned long lastToggle     = 0;

bool apiLedState    = true;
bool apiBuzzerState = true;
bool apiLampState   = true;
bool stopAlert      = false;

// ================= QUEUES =================
typedef struct {
  char state[10];
} DoorMessage;

typedef struct {
  char state[4];
} AlertMessage;

QueueHandle_t doorQueue;
QueueHandle_t alertQueue;

// ================= HELPERS =================
void setAllLEDs(uint32_t color)
{
  for (int i = 0; i < LED_COUNT; i++)
  {
    strip1.setPixelColor(i, color);
    strip2.setPixelColor(i, color);
  }
  strip1.show();
  strip2.show();
}

void clearAllLEDs()
{
  strip1.clear();
  strip2.clear();
  strip1.show();
  strip2.show();
}

void flushQueues()
{
  DoorMessage  dm;
  AlertMessage am;
  while (xQueueReceive(doorQueue,  &dm, 0) == pdTRUE) {}
  while (xQueueReceive(alertQueue, &am, 0) == pdTRUE) {}
}

void sendAlertState(bool active)
{
  AlertMessage msg;
  memset(&msg, 0, sizeof(msg));
  strcpy(msg.state, active ? "1" : "0");
  xQueueSend(alertQueue, &msg, 0);
}

// SHEET STUFFS (CORE 0)
void sheetTask(void *parameter)
{
  HTTPClient http;

  for (;;)
  {
    if (WiFi.status() != WL_CONNECTED)
    {
      vTaskDelay(500 / portTICK_PERIOD_MS);
      continue;
    }

    DoorMessage doorMsg;
    memset(&doorMsg, 0, sizeof(doorMsg));
    if (xQueueReceive(doorQueue, &doorMsg, 0) == pdTRUE)
    {
      String val = String(doorMsg.state);
      if (val == "OPEN" || val == "CLOSED")
      {
        String url = String(googleScriptURL) + "?door=" + val;
        http.setTimeout(5000);
        http.begin(url);
        int code = http.GET();
        if (code > 0) Serial.println("door > " + val);
        else          Serial.println("door err: " + String(code));
        http.end();
      }
      else
      {
        Serial.println("door blocked: " + val);
      }
    }

    AlertMessage alertMsg;
    memset(&alertMsg, 0, sizeof(alertMsg));
    if (xQueueReceive(alertQueue, &alertMsg, 0) == pdTRUE)
    {
      String val = String(alertMsg.state);
      if (val == "1" || val == "0")
      {
        String url = String(ctrlsScriptURL) + "?alert=" + val;
        http.setTimeout(5000);
        http.begin(url);
        int code = http.GET();
        if (code > 0) Serial.println("alert > " + val);
        else          Serial.println("alert err: " + String(code));
        http.end();
      }
    }

    vTaskDelay(20 / portTICK_PERIOD_MS);
  }
}

// CTRLS STUFFS (CORE 0)
void controlTask(void *parameter)
{
  HTTPClient http;
  unsigned long lastControlFetch = 0;

  for (;;)
  {
    if (WiFi.status() != WL_CONNECTED)
    {
      Serial.println("wifi lost");
      WiFi.begin(ssid, password);
      vTaskDelay(2000 / portTICK_PERIOD_MS);
      continue;
    }

    if (millis() - lastControlFetch > 2000)
    {
      lastControlFetch = millis();
      http.setTimeout(5000);
      http.begin(ctrlsScriptURL);
      http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

      int code = http.GET();
      if (code > 0)
      {
        String payload = http.getString();
        Serial.println("API: " + payload);

        StaticJsonDocument<256> doc;
        DeserializationError err = deserializeJson(doc, payload);

        if (!err &&
            doc.containsKey("led") &&
            doc.containsKey("buzzer") &&
            doc.containsKey("stop") &&
            doc.containsKey("lamp"))
        {
          bool newLed    = doc["led"].as<int>()    == 1;
          bool newBuzzer = doc["buzzer"].as<int>() == 1;
          bool newStop   = doc["stop"].as<int>()   == 1;
          bool newLamp   = doc["lamp"].as<int>()   == 1;

          portENTER_CRITICAL(&mux);
          bool prevLamp  = apiLampState;
          apiLedState    = newLed;
          apiBuzzerState = newBuzzer;
          stopAlert      = newStop;
          apiLampState   = newLamp;
          portEXIT_CRITICAL(&mux);

          if (!newLamp)
          {
            portENTER_CRITICAL(&mux);
            lampOn = false;
            portEXIT_CRITICAL(&mux);
          }

          if (newLamp && !prevLamp)
          {
            bool pirHigh = digitalRead(PIR_PIN) == HIGH;
            if (pirHigh)
            {
              portENTER_CRITICAL(&mux);
              lampOn = true;
              portEXIT_CRITICAL(&mux);
            }
          }

          Serial.printf("API | LED=%d BUZ=%d STOP=%d LAMP=%d\n",
                        newLed, newBuzzer, newStop, newLamp);
        }
        else
        {
          Serial.println("api: bad json");
        }
      }
      else
      {
        Serial.println("api err: " + String(code));
      }

      http.end();
    }

    vTaskDelay(20 / portTICK_PERIOD_MS);
  }
}

// SENSOR STUFFS (CORE 1)
void sensorTask(void *parameter)
{
  for (;;)
  {
    unsigned long now = millis();

    bool doorRaw = digitalRead(IR_PIN) == HIGH;

    if (doorRaw != lastDoorRaw)
    {
      lastDoorRaw      = doorRaw;
      doorDebounceTime = now;
    }

    if ((now - doorDebounceTime >= DEBOUNCE_MS) && (doorRaw != lastDoorState))
    {
      lastDoorState = doorRaw;

      portENTER_CRITICAL(&mux);
      doorOpen = doorRaw;
      if (doorRaw) doorOpenTime = millis();
      portEXIT_CRITICAL(&mux);

      Serial.println("door = " + String(doorRaw ? "open" : "closed"));

      DoorMessage doorMsg;
      memset(&doorMsg, 0, sizeof(doorMsg));
      strcpy(doorMsg.state, doorRaw ? "OPEN" : "CLOSED");
      xQueueSend(doorQueue, &doorMsg, 0);

      if (doorRaw)
      {
        portENTER_CRITICAL(&mux);
        alertActive = false;
        portEXIT_CRITICAL(&mux);
      }
      else
      {
        portENTER_CRITICAL(&mux);
        alertActive     = false;
        alertSuppressed = false;
        portEXIT_CRITICAL(&mux);

        digitalWrite(BUZZER_PIN, LOW);
        Serial.println("alert = off");
      }
    }

    bool motionRaw = digitalRead(PIR_PIN) == HIGH;

    if (motionRaw != lastMotionRaw)
    {
      lastMotionRaw      = motionRaw;
      motionDebounceTime = now;
    }

    if ((now - motionDebounceTime >= DEBOUNCE_MS) && (motionRaw != lastMotionState))
    {
      lastMotionState = motionRaw;

      portENTER_CRITICAL(&mux);
      motionDetected = motionRaw;
      portEXIT_CRITICAL(&mux);

      if (motionRaw)
      {
        portENTER_CRITICAL(&mux);
        bool lampAllowed = apiLampState;
        portEXIT_CRITICAL(&mux);

        if (lampAllowed)
        {
          portENTER_CRITICAL(&mux);
          lampOn = true;
          portEXIT_CRITICAL(&mux);
        }
      }
      else
      {
        portENTER_CRITICAL(&mux);
        lampOffTime = millis();
        portEXIT_CRITICAL(&mux);
      }
    }

    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}

// ALERT STUFFS (CORE 1)
void alertTask(void *parameter)
{
  for (;;)
  {
    unsigned long now = millis();

    portENTER_CRITICAL(&mux);
    bool currentDoorOpen              = doorOpen;
    bool currentStopAlert             = stopAlert;
    bool currentApiLed                = apiLedState;
    bool currentApiBuzzer             = apiBuzzerState;
    bool currentApiLamp               = apiLampState;
    bool currentAlertActive           = alertActive;
    bool currentAlertSuppressed       = alertSuppressed;
    bool currentLampOn                = lampOn;
    bool currentMotion                = motionDetected;
    unsigned long currentDoorOpenTime = doorOpenTime;
    unsigned long currentLampOffTime  = lampOffTime;
    portEXIT_CRITICAL(&mux);

    if (currentAlertActive != lastAlertActive)
    {
      lastAlertActive = currentAlertActive;
      sendAlertState(currentAlertActive);
    }

    if (currentStopAlert)
    {
      portENTER_CRITICAL(&mux);
      stopAlert       = false;
      alertActive     = false;
      alertSuppressed = true;
      portEXIT_CRITICAL(&mux);

      beepState = false;
      digitalWrite(BUZZER_PIN, LOW);
      clearAllLEDs();
      Serial.println("alert = stop");

      portENTER_CRITICAL(&mux);
      currentLampOn  = lampOn;
      currentApiLamp = apiLampState;
      portEXIT_CRITICAL(&mux);

      if (currentLampOn && currentApiLamp)
        setAllLEDs(strip1.Color(255, 255, 255));

      vTaskDelay(10 / portTICK_PERIOD_MS);
      continue;
    }

    if (currentDoorOpen && !currentAlertSuppressed)
    {
      if (!currentAlertActive && now - currentDoorOpenTime > 5000) // should be 3 mins but for testing i put 5s
      {
        portENTER_CRITICAL(&mux);
        alertActive    = true;
        alertStartTime = millis();
        portEXIT_CRITICAL(&mux);

        lastToggle = millis();
        Serial.println("alert = on");
      }

      portENTER_CRITICAL(&mux);
      currentAlertActive = alertActive;
      unsigned long currentAlertStartTime = alertStartTime;
      portEXIT_CRITICAL(&mux);

      if (currentAlertActive)
      {
        if (now - currentAlertStartTime > 20000)
        {
          portENTER_CRITICAL(&mux);
          alertActive     = false;
          alertSuppressed = true;
          portEXIT_CRITICAL(&mux);

          beepState = false;
          digitalWrite(BUZZER_PIN, LOW);
          Serial.println("alert = timeout");

          portENTER_CRITICAL(&mux);
          currentLampOn  = lampOn;
          currentApiLamp = apiLampState;
          portEXIT_CRITICAL(&mux);

          if (currentLampOn && currentApiLamp)
            setAllLEDs(strip1.Color(255, 255, 255));
          else
            clearAllLEDs();
        }
        else if (now - lastToggle > 250)
        {
          lastToggle = now;
          beepState  = !beepState;

          digitalWrite(BUZZER_PIN, beepState && currentApiBuzzer ? HIGH : LOW);

          if (currentApiLed && beepState)
            setAllLEDs(strip1.Color(255, 0, 0));
          else
            clearAllLEDs();

          Serial.printf("alert | buz=%d led=%d\n",
                        (beepState && currentApiBuzzer) ? 1 : 0,
                        (currentApiLed && beepState)    ? 1 : 0);
        }

        vTaskDelay(10 / portTICK_PERIOD_MS);
        continue;
      }
    }

    if (currentLampOn && currentApiLamp)
    {
      if (!currentMotion && now - currentLampOffTime > 10000)
      {
        portENTER_CRITICAL(&mux);
        lampOn = false;
        portEXIT_CRITICAL(&mux);

        clearAllLEDs();
      }
      else
      {
        setAllLEDs(strip1.Color(255, 255, 255));
      }
    }
    else
    {
      clearAllLEDs();
    }

    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}

// SETUP
void setup()
{
  Serial.begin(115200);

  pinMode(IR_PIN,     INPUT);
  pinMode(PIR_PIN,    INPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  strip1.begin();
  strip2.begin();
  clearAllLEDs();

  WiFi.begin(ssid, password);
  Serial.print("wifi...");

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" ok");

  doorQueue  = xQueueCreate(10, sizeof(DoorMessage));
  alertQueue = xQueueCreate(10, sizeof(AlertMessage));

  flushQueues();

  xTaskCreatePinnedToCore(sensorTask,  "SensorTask",  8192, NULL, 1, NULL, 1);
  xTaskCreatePinnedToCore(alertTask,   "AlertTask",   8192, NULL, 1, NULL, 1);
  xTaskCreatePinnedToCore(sheetTask,   "SheetTask",   8192, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(controlTask, "ControlTask", 8192, NULL, 1, NULL, 0);
}

void loop() {}
