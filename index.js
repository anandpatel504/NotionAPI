const express = require("express");
const app = express();
const { Client } = require("@notionhq/client");
const { WebClient } = require("@slack/web-api");
const _ = require("lodash");
const Dotenv = require("dotenv");
Dotenv.config({ path: `${__dirname}/.env` });
const morgan = require("morgan");
const PORT = process.env.PORT || 2021;

app.use(express.json());
app.use(express.urlencoded());
app.use(morgan("dev"));

// Read a token from the environment variables
const token = process.env.SLACK_TOKEN;

// Initialize
const web = new WebClient(token);

// Initializing a client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

// Query a database
app.post("/coders", async (req, res) => {
  console.log(req.body);
  const databaseId = process.env.databaseId;
  const response = await notion.databases.query({ database_id: databaseId });
  console.log(response.results, "response\n");
  let data;
  const notionData = [];
  let conversationId = "general";
  _.map(response.results, async (item) => {
    const name = item.properties.Name.title[0].plain_text;
    const mobile = item.properties.Mobile.phone_number;
    const email = item.properties.Email.email;
    const status = item.properties.Status.select.name;
    const date_created = item.created_time;
    // console.log({ name, mobile, email, status, date_created }, "data");
    const data = { name, mobile, email, status, date_created };
    notionData.push(data);

    try {
      // Post a message to the channel, and await the result.
      // Find more arguments and details of the response: https://api.slack.com/methods/chat.postMessage
      // Call the chat.postMessage method using the WebClient
      const result = await web.chat.postMessage({
        channel: conversationId,
        blocks: [
          {
            type: "section",
            text: {
              type: "plain_text",
              text: name,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Mark as Done",
                  emoji: true,
                },
              },
            ],
          },
        ],
      });
      //   console.log(result, "result");
    } catch (error) {
      console.error(error, ".,............error aa rha hai bhai");
    }
  });
  //   console.log(notionData, "data");
  res.send("");
});

app.post("/createCoder", (req, res) => {
  const trigger_id = req.body.trigger_id;
  console.log(trigger_id);
  try {
    web.dialog.open({
      trigger_id: trigger_id,
      dialog: {
        title: "Create Coder",
        callback_id: "create_coder",
        elements: [
          //   {
          //     label: "Select Coder:",
          //     type: "select",
          //     name: "user",
          //     data_source: "users",
          //     placeholder: "Select Coder...",
          //   },
          {
            label: "What's the Name?",
            type: "text",
            name: "name",
          },
          {
            label: "What's the Email?",
            type: "text",
            name: "email",
          },
          {
            label: "What's the Mobile number?",
            type: "text",
            name: "mobile",
          },
        ],
      },
    });
  } catch (error) {}
});

// form-submit
app.post("/form-submit", async (req, res) => {
  console.log(req.body);
  const payload = JSON.parse(req.body.payload);
  if (!Object.keys(payload).includes("submission")) {
    const result = await web.reactions.add({
      channel: payload.channel.id,
      name: "white_check_mark",
      timestamp: payload.message.ts,
    });
    // update page data
    const searchPage = await notion.search({
      query: payload.message.blocks[0].text.text,
    });
    console.log(searchPage, "searchPage");
    const response = await notion.pages.update({
      page_id: searchPage.results[0].id,
      properties: {
        Status: {
          select: {
            name: "Done 🙌",
          },
        },
      },
    });
    res.send("");
  } else {
    try {
      console.log(payload.channel.id, "chanel\n\n");
      const result = await web.chat.postMessage({
        channel: "general",
        blocks: [
          {
            type: "section",
            text: {
              type: "plain_text",
              text: payload.submission.name,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Mark as Done",
                  emoji: true,
                },
              },
            ],
          },
        ],
      });
      // Create a page
      const response = await notion.pages.create({
        parent: {
          database_id: process.env.databaseId,
        },
        properties: {
          Status: {
            select: {
              name: "To Do",
            },
          },
          Name: {
            title: [
              {
                text: {
                  content: payload.submission.name,
                },
              },
            ],
          },
          Email: {
            email: payload.submission.email,
          },
          Mobile: {
            phone_number: payload.submission.mobile,
          },
        },
      });
      console.log(response);
    } catch (error) {
      console.log(error);
    }
    res.send("");
  }
});

app.listen(PORT, () => {
  console.log(`Server started http://localhost:${PORT}/`);
});
