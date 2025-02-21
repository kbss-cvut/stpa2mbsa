const BASE_URL = "https://api.openai.com/v1/chat/completions";
let API_KEY;

function loadApiKey() {
  API_KEY = SpreadsheetApp.getActive()
    .getSheetByName("How to use")
    .getRange(17, 1)
    .getValue();
}

function isChatGptAvailable() {
  return API_KEY && API_KEY.length > 0;
}

function retrieveChatGptResponse(userContent) {
  if (API_KEY.length === 0 || API_KEY === "Input API key here") {
    return undefined;
  }
  console.log("Using ChatGPT to generate analysis output.");
  try {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    };

    const options = {
      headers,
      method: "POST",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a safety analyst using the STPA methodology.",
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        temperature: 0.5,
      }),
    };

    const response = JSON.parse(UrlFetchApp.fetch(BASE_URL, options));
    console.log(response);
    console.log(response.choices[0].message.content);
    return response.choices[0].message.content;
  } catch (e) {
    console.log(e);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Failed to retrieve response from ChatGPT. Using an internally generated value.",
    );
    return undefined;
  }
}
