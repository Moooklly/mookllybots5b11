const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot has arrived');
});

app.listen(8000, () => {
  console.log('Server started');
});

function createBot() {
   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      password: config['bot-account']['password'],
      auth: config['bot-account']['type'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
   });

   bot.loadPlugin(pathfinder);
   const mcData = require('minecraft-data')(bot.version);
   const defaultMove = new Movements(bot, mcData);
   bot.settings.colorsEnabled = false;

   let pendingPromise = Promise.resolve();

   function sendRegister(password) {
      return new Promise((resolve, reject) => {
         bot.chat(`/register ${password} ${password}`);
         console.log(`[Auth] Sent /register command.`);

         bot.once('chat', (username, message) => {
            console.log(`[ChatLog] <${username}> ${message}`);

            if (message.includes('successfully registered')) {
               console.log('[INFO] Registration confirmed.');
               resolve();
            } else if (message.includes('already registered')) {
               console.log('[INFO] Bot was already registered.');
               resolve();
            } else if (message.includes('Invalid command')) {
               reject(`Registration failed: Invalid command. Message: "${message}"`);
            } else {
               reject(`Registration failed: unexpected message "${message}".`);
            }
         });
      });
   }

   function sendLogin(password) {
      return new Promise((resolve, reject) => {
         bot.chat(`/login ${password}`);
         console.log(`[Auth] Sent /login command.`);

         bot.once('chat', (username, message) => {
            console.log(`[ChatLog] <${username}> ${message}`);

            if (message.includes('successfully logged in')) {
               console.log('[INFO] Login successful.');
               resolve();
            } else if (message.includes('Invalid password')) {
               reject(`Login failed: Invalid password. Message: "${message}"`);
            } else if (message.includes('not registered')) {
               reject(`Login failed: Not registered. Message: "${message}"`);
            } else {
               reject(`Login failed: unexpected message "${message}".`);
            }
         });
      });
   }

   bot.once('spawn', () => {
      console.log('\x1b[33m[AfkBot] Bot joined the server', '\x1b[0m');

      if (config.utils['auto-auth'].enabled) {
         console.log('[INFO] Started auto-auth module');

         const password = config.utils['auto-auth'].password;

         pendingPromise = pendingPromise
            .then(() => sendRegister(password))
            .then(() => sendLogin(password))
            .catch(error => console.error('[ERROR]', error));
      }

      if (config.utils['chat-messages'].enabled) {
         console.log('[INFO] Started chat-messages module');
         const messages = config.utils['chat-messages']['messages'];

         if (config.utils['chat-messages'].repeat) {
            const delay = config.utils['chat-messages']['repeat-delay'];
            let i = 0;

            let msg_timer = setInterval(() => {
               bot.chat(`${messages[i]}`);

               if (i + 1 === messages.length) {
                  i = 0;
               } else {
                  i++;
               }
            }, delay * 1000);
         } else {
            messages.forEach((msg) => {
               bot.chat(msg);
            });
         }
      }

      const pos = config.position;

      if (config.position.enabled) {
         console.log(
            `\x1b[32m[Afk Bot] Starting to move to target location (${pos.x}, ${pos.y}, ${pos.z})\x1b[0m`
         );
         bot.pathfinder.setMovements(defaultMove);
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      if (config.utils['anti-afk'].enabled) {
         bot.setControlState('jump', true);
         if (config.utils['anti-afk'].sneak) {
            bot.setControlState('sneak', true);
         }
      }

      // ✅ تعريف المتغيرات المطلوبة — مكانها الصحيح
      const tpaRequests = {};
      const cooldowns = {};

      // ===============================
      // ✅ أوامر الشات
      // ===============================
bot.on('chat', (username, message) => {
  if (username === bot.username) return;

  const args = message.trim().split(' ');
  const now = Date.now();
  const cooldown = cooldowns[username];

 // ==================================================
// ✅ نظام تخزين طلبات الـ TPA
// ==================================================
const tpaRequests = {}; 
// الشكل:
// tpaRequests[username] = {
//   time: <Timestamp>,
//   status: "pending"
// };

// ==================================================
// ✅ استقبال الشات (حط هذا الحدث عندك)
// ==================================================
bot.on("chat", (username, message) => {
    if (username === bot.username) return;

    // ================================
    // ✅ أمر !tpa (طلب يجي لعندك)
    // ================================
    if (message === "!tpa") {
        tpaRequests[username] = {
            status: "pending",
            time: Date.now()
        };

        bot.chat(`✅ ${username} طلب TPA`);
        bot.chat(`ℹ️ اكتب !ac للقبول أو !dc للرفض`);
        bot.chat(`⏳ بينتهي الطلب بعد دقيقتين`);

        // 🔥 حذف الطلب تلقائيًا بعد دقيقتين
        setTimeout(() => {
            if (tpaRequests[username] && tpaRequests[username].status === "pending") {
                delete tpaRequests[username];
                bot.chat(`⌛ انتهى وقت طلب TPA من ${username}`);
            }
        }, 2 * 60 * 1000);
    }

    // ================================
    // ✅ أمر !ac (قبول آخر طلب)
    // ================================
    if (message === "!ac") {

        // البحث عن أول طلب pending
        const sender = Object.keys(tpaRequests).find(
            u => tpaRequests[u].status === "pending"
        );

        if (!sender) {
            bot.chat("❌ ما فيه أي طلب TPA");
            return;
        }

        tpaRequests[sender].status = "accepted";

        bot.chat(`✅ قبلت طلب TPA من: ${sender}`);
        bot.chat(`/tp ${sender} ${bot.username}`);

        delete tpaRequests[sender];
    }

    // ================================
    // ✅ أمر !dc (رفض آخر طلب)
    // ================================
    if (message === "!dc") {

        const sender = Object.keys(tpaRequests).find(
            u => tpaRequests[u].status === "pending"
        );

        if (!sender) {
            bot.chat("❌ ما فيه أي طلب TPA");
            return;
        }

        bot.chat(`❌ رفضت طلب TPA من: ${sender}`);

        delete tpaRequests[sender];
    }

  // ===== باقي أوامرك =====
  if (args[0].toLowerCase() === '!s') {
    const x = 381, y = 63, z = 446;
    bot.chat(`/tell ${username} 🚀 تم نقلك الآن إلى X:${x} Y:${y} Z:${z}`);
    bot.chat(`/tp ${username} ${x} ${y} ${z}`);
    return;
  }

  if (args[0].toLowerCase() === '!123123131') {
    const x = -649, y = 71, z = -3457;
    bot.chat(`/tell ${username} 🚀 تم نقلك الآن إلى X:${x} Y:${y} Z:${z}`);
    bot.chat(`/tp ${username} ${x} ${y} ${z}`);
    return;
  }

  if (args[0].toLowerCase() === '!123123123123123') {
    const x = -2136, y = 65, z = -74;
    bot.chat(`/tell ${username} 🚀 تم نقلك الآن إلى X:${x} Y:${y} Z:${z}`);
    bot.chat(`/tp ${username} ${x} ${y} ${z}`);
    return;
  }

  if (args[0].toLowerCase() === '!we') {
    bot.chat(`🌅 تم تنظيف الجو`);
    bot.chat(`/weather clear`);
    return;
  }

  if (message.toLowerCase().includes('sp?')) bot.chat(`Hi ${username}`);
  if (message === '!help') bot.chat(`Commands: !tpa <@> , !we`);
  if (message === '!time')
    bot.chat(`/tell ${username} ⌛ Time: ${Math.floor(bot.time.timeOfDay / 1000)}`);
    });
});

   bot.on('goal_reached', () => {
      console.log(
         `\x1b[32m[AfkBot] Bot arrived at the target location. ${bot.entity.position}\x1b[0m`
      );
   });

   bot.on('death', () => {
      console.log(
         `\x1b[33m[AfkBot] Bot has died and respawned at ${bot.entity.position}`,
         '\x1b[0m'
      );
   });

   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         setTimeout(() => {
            createBot();
         }, config.utils['auto-recconect-delay']);
      });
   }

   bot.on('kicked', (reason) =>
      console.log(
         '\x1b[33m',
         `[AfkBot] Bot was kicked. Reason:\n${reason}`,
         '\x1b[0m'
      )
   );

   bot.on('error', (err) =>
      console.log(`\x1b[31m[ERROR] ${err.message}`, '\x1b[0m')
   );
}

createBot();
