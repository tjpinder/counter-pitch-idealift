/**
 * Counter Pitch - Gmail Integration
 *
 * Google Apps Script that scans for cold pitch emails,
 * generates counter-pitches via the Counter Pitch API,
 * and creates draft replies (or auto-sends for repeat offenders).
 *
 * Setup:
 * 1. Open script.google.com, create a new project
 * 2. Paste this code into Code.gs
 * 3. Update appsscript.json manifest (View > Show manifest)
 * 4. Set script properties (Project Settings > Script properties):
 *    - API_URL: https://counter-pitch-idealift.azurewebsites.net
 *    - API_KEY: (your SITE_API_KEY value)
 *    - AUTO_SEND_THRESHOLD: 4 (set to 0 to disable auto-send)
 *    - DISCORD_NOTIFY: true (set to false to disable)
 * 5. Run setupTrigger() once to create the 5-minute timer
 * 6. Authorize when prompted
 */

// ============================================================
// CONFIGURATION
// ============================================================

var LABEL_NAME = 'counter-pitched';
var SEARCH_NEWER_THAN = '1d';

// ============================================================
// MAIN
// ============================================================

/**
 * Run once to set up the recurring trigger.
 */
function setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processInbox') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('processInbox')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Trigger created: processInbox every 5 minutes');

  // Run immediately so new inboxes get scanned right away
  processInbox();
  Logger.log('Initial inbox scan complete');
}

/**
 * Remove the recurring trigger.
 */
function removeTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processInbox') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  Logger.log('Trigger removed');
}

/**
 * Main function: scan inbox, detect cold pitches, generate counter-pitches.
 */
function processInbox() {
  var label = getOrCreateLabel(LABEL_NAME);
  var baseQuery = '-from:me -label:' + LABEL_NAME + ' newer_than:' + SEARCH_NEWER_THAN;

  // Search inbox and spam separately (GmailApp.search excludes spam/trash by default)
  Logger.log('Inbox query: ' + baseQuery);
  var threads = GmailApp.search(baseQuery, 0, 20);
  Logger.log('Inbox threads found: ' + threads.length);

  var spamQuery = 'in:spam ' + baseQuery;
  Logger.log('Spam query: ' + spamQuery);
  var spamThreads = GmailApp.search(spamQuery, 0, 10);
  Logger.log('Spam threads found: ' + spamThreads.length);

  // Track which threads are from spam
  var spamThreadIds = {};
  for (var s = 0; s < spamThreads.length; s++) {
    spamThreadIds[spamThreads[s].getId()] = true;
  }
  if (spamThreads.length > 0) {
    threads = threads.concat(spamThreads);
  }
  Logger.log('Total threads to process: ' + threads.length);

  var processedSenders = {};

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();
    var lastMessage = messages[messages.length - 1];

    var body = lastMessage.getPlainBody();
    var from = lastMessage.getFrom();
    Logger.log('Processing thread from: ' + from);

    // AI-powered cold pitch detection
    var isColdPitch = detectColdPitch(body, from);
    Logger.log('Cold pitch detection for ' + from + ': ' + isColdPitch);
    if (!isColdPitch) {
      continue;
    }

    var senderInfo = parseSender(from);

    // Only process one thread per sender per run
    if (processedSenders[senderInfo.key]) {
      thread.addLabel(label);
      Logger.log('Skipped duplicate sender in same run: ' + from);
      continue;
    }
    processedSenders[senderInfo.key] = true;

    var pitchCount = incrementPitchCount(senderInfo.key);

    // Collect full thread messages for context
    var threadMessages = [];
    for (var j = 0; j < messages.length; j++) {
      threadMessages.push(messages[j].getPlainBody());
    }

    // Auto-send for spam threads or repeat offenders past threshold
    var isSpam = !!spamThreadIds[thread.getId()];
    var autoSendThreshold = parseInt(PropertiesService.getScriptProperties().getProperty('AUTO_SEND_THRESHOLD') || '0');
    var shouldAutoSend = isSpam || (autoSendThreshold > 0 && pitchCount >= autoSendThreshold);

    try {
      var result = callCounterPitchAPI({
        senderName: senderInfo.name,
        senderCompany: senderInfo.company,
        websiteUrl: senderInfo.domain ? 'https://' + senderInfo.domain : '',
        emailText: body,
        pitchCount: pitchCount,
        threadMessages: threadMessages.length > 1 ? threadMessages : undefined,
        source: 'gmail-auto',
        autoSent: shouldAutoSend
      });

      if (result && result.body) {
        var subject = result.subject || ('Re: ' + lastMessage.getSubject());

        if (shouldAutoSend) {
          // AUTO-SEND for repeat offenders
          lastMessage.reply(result.body);
          Logger.log('AUTO-SENT to: ' + from + ' (pitch #' + pitchCount + ', level ' + result.level + ')');
        } else {
          // Create draft for review
          thread.createDraftReply(result.body, {
            subject: subject
          });
          Logger.log('Draft created for: ' + from + ' (pitch #' + pitchCount + ', level ' + result.level + ')');
        }

        thread.addLabel(label);
      }
    } catch (e) {
      Logger.log('Error processing ' + from + ': ' + e.message);
    }
  }
}

// ============================================================
// COLD PITCH DETECTION (AI-powered)
// ============================================================

/**
 * Use Claude to classify whether an email is a cold pitch.
 * Falls back to keyword heuristic if API call fails.
 */
function detectColdPitch(body, from) {
  // Skip trusted domains
  var trustedDomains = getTrustedDomains();
  var fromDomain = extractDomain(from);
  if (trustedDomains.indexOf(fromDomain) !== -1) {
    return false;
  }

  try {
    var result = callClassifyAPI(body, from);
    if (result && typeof result.isColdPitch === 'boolean') {
      if (result.confidence < 0.6) return false; // Low confidence, skip
      return result.isColdPitch;
    }
  } catch (e) {
    Logger.log('Classification API failed, falling back to keywords: ' + e.message);
  }

  // Fallback: keyword heuristic
  return keywordHeuristic(body);
}

/**
 * Fallback keyword-based cold pitch detection.
 */
function keywordHeuristic(body) {
  var keywords = [
    'quick call', 'partnership opportunity', 'reaching out',
    'I noticed your company', 'would love to connect', 'I came across',
    'boost your', 'grow your', 'increase your revenue', 'schedule a demo',
    'free audit', 'free trial', 'we help companies', 'we specialize in',
    'I wanted to reach out', 'are you the right person', 'just following up',
    'checking in on my last email', 'we work with companies like',
    'thought you might be interested', 'scale your', 'transform your'
  ];

  var lowerBody = body.toLowerCase();
  var matchCount = 0;
  for (var i = 0; i < keywords.length; i++) {
    if (lowerBody.indexOf(keywords[i].toLowerCase()) !== -1) {
      matchCount++;
    }
  }
  return matchCount >= 2;
}

/**
 * Get trusted domains that should never be flagged.
 */
function getTrustedDomains() {
  return [
    'idealift.app',
    'startvest.ai',
    'gmail.com',
  ];
}

// ============================================================
// SENDER PARSING
// ============================================================

function parseSender(from) {
  var name = '';
  var email = '';

  var match = from.match(/^"?([^"<]+)"?\s*<(.+)>/);
  if (match) {
    name = match[1].trim();
    email = match[2].trim();
  } else {
    email = from.trim();
  }

  var domain = email.split('@')[1] || '';
  var company = domain.split('.')[0] || '';
  company = company.charAt(0).toUpperCase() + company.slice(1);

  return {
    name: name || email.split('@')[0],
    email: email,
    company: company,
    domain: domain,
    key: (name + '|' + company).toLowerCase()
  };
}

function extractDomain(from) {
  var match = from.match(/@([^>]+)/);
  return match ? match[1].toLowerCase() : '';
}

// ============================================================
// PITCH COUNT TRACKING
// ============================================================

function incrementPitchCount(senderKey) {
  var props = PropertiesService.getUserProperties();
  var counts = JSON.parse(props.getProperty('pitchCounts') || '{}');
  counts[senderKey] = (counts[senderKey] || 0) + 1;
  props.setProperty('pitchCounts', JSON.stringify(counts));
  return counts[senderKey];
}

function getPitchCount(senderKey) {
  var props = PropertiesService.getUserProperties();
  var counts = JSON.parse(props.getProperty('pitchCounts') || '{}');
  return counts[senderKey] || 0;
}

function resetPitchCounts() {
  PropertiesService.getUserProperties().deleteProperty('pitchCounts');
  Logger.log('Pitch counts reset');
}

// ============================================================
// API CALLS
// ============================================================

function getAPIConfig() {
  var props = PropertiesService.getScriptProperties();
  var apiUrl = props.getProperty('API_URL');
  var apiKey = props.getProperty('API_KEY');
  if (!apiUrl || !apiKey) {
    throw new Error('API_URL and API_KEY must be set in Script Properties');
  }
  return { apiUrl: apiUrl.replace(/\/$/, ''), apiKey: apiKey };
}

function callCounterPitchAPI(params) {
  var config = getAPIConfig();
  var url = config.apiUrl + '/api/counter-pitch/sync';

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': config.apiKey },
    payload: JSON.stringify(params),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code !== 200) {
    throw new Error('API returned ' + code + ': ' + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}

function callClassifyAPI(emailText, from) {
  var config = getAPIConfig();
  var url = config.apiUrl + '/api/classify';

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': config.apiKey },
    payload: JSON.stringify({ emailText: emailText, from: from }),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code !== 200) {
    throw new Error('Classify API returned ' + code);
  }

  return JSON.parse(response.getContentText());
}

// ============================================================
// GMAIL ADD-ON (Phase 2)
// ============================================================

function onHomepage(e) {
  return createHomepageCard();
}

function onGmailMessage(e) {
  var messageId = e.gmail.messageId;
  var accessToken = e.gmail.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);

  var message = GmailApp.getMessageById(messageId);
  var from = message.getFrom();
  var body = message.getPlainBody();
  var senderInfo = parseSender(from);
  var currentCount = getPitchCount(senderInfo.key);

  // Collect thread messages
  var thread = message.getThread();
  var messages = thread.getMessages();
  var threadMessages = [];
  for (var i = 0; i < messages.length; i++) {
    threadMessages.push(messages[i].getPlainBody());
  }

  return createMessageCard(senderInfo, body, currentCount, messageId, threadMessages);
}

function createHomepageCard() {
  var props = PropertiesService.getUserProperties();
  var counts = JSON.parse(props.getProperty('pitchCounts') || '{}');
  var total = Object.keys(counts).length;

  var autoThreshold = PropertiesService.getScriptProperties().getProperty('AUTO_SEND_THRESHOLD') || '0';

  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('COUNTER PITCH')
      .setSubtitle('They pitch you. Tom pitches back harder.'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText('Tracked senders: ' + total + '\nAuto-send threshold: pitch #' + autoThreshold))
      .addWidget(CardService.newTextButton()
        .setText('RESET PITCH COUNTS')
        .setOnClickAction(CardService.newAction()
          .setFunctionName('onResetCounts'))));

  return card.build();
}

function createMessageCard(senderInfo, body, currentCount, messageId, threadMessages) {
  var nextCount = currentCount + 1;
  var chaosLabel = nextCount === 1 ? 'REAL MODE' :
                   nextCount === 2 ? 'CHAOS MODE' :
                   'UNHINGED MODE (pitch #' + nextCount + ')';

  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('COUNTER PITCH')
      .setSubtitle(chaosLabel))
    .addSection(CardService.newCardSection()
      .setHeader('Sender')
      .addWidget(CardService.newKeyValue()
        .setTopLabel('Name')
        .setContent(senderInfo.name))
      .addWidget(CardService.newKeyValue()
        .setTopLabel('Company')
        .setContent(senderInfo.company))
      .addWidget(CardService.newKeyValue()
        .setTopLabel('Pitches from this sender')
        .setContent(String(currentCount))))
    .addSection(CardService.newCardSection()
      .setHeader('Chaos Override')
      .addWidget(CardService.newSelectionInput()
        .setType(CardService.SelectionInputType.RADIO_BUTTON)
        .setFieldName('chaosOverride')
        .addItem('Auto (based on pitch count)', '0', true)
        .addItem('Real Mode', '1', false)
        .addItem('Chaos Mode', '2', false)
        .addItem('Nuclear Mode', '3', false))
      .addWidget(CardService.newTextButton()
        .setText('FIRE BACK')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(CardService.newAction()
          .setFunctionName('onFireBack')
          .setParameters({
            senderName: senderInfo.name,
            senderCompany: senderInfo.company,
            senderDomain: senderInfo.domain || '',
            senderKey: senderInfo.key,
            emailBody: body.substring(0, 5000),
            messageId: messageId,
            threadMessages: JSON.stringify(threadMessages.map(function(m) { return m.substring(0, 2000); }))
          }))));

  return card.build();
}

function onFireBack(e) {
  var params = e.commonEventObject.parameters;
  var chaosOverride = parseInt(e.commonEventObject.formInputs && e.commonEventObject.formInputs.chaosOverride
    ? e.commonEventObject.formInputs.chaosOverride.stringInputs.value[0]
    : '0');

  var pitchCount = incrementPitchCount(params.senderKey);

  var threadMessages;
  try {
    threadMessages = JSON.parse(params.threadMessages);
  } catch (err) {
    threadMessages = undefined;
  }

  try {
    var apiParams = {
      senderName: params.senderName,
      senderCompany: params.senderCompany,
      websiteUrl: params.senderDomain ? 'https://' + params.senderDomain : '',
      emailText: params.emailBody,
      pitchCount: pitchCount,
      threadMessages: threadMessages && threadMessages.length > 1 ? threadMessages : undefined,
      source: 'gmail-addon',
      autoSent: false
    };
    if (chaosOverride > 0) apiParams.chaosOverride = chaosOverride;

    var result = callCounterPitchAPI(apiParams);

    var levelLabel = result.level === 1 ? 'REAL MODE' :
                     result.level === 2 ? 'CHAOS MODE' : 'UNHINGED MODE';

    var message = GmailApp.getMessageById(params.messageId);
    var thread = message.getThread();
    var subject = result.subject || ('Re: ' + message.getSubject());

    thread.createDraftReply(result.body, { subject: subject });

    var label = getOrCreateLabel(LABEL_NAME);
    thread.addLabel(label);

    var card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('FIRED BACK')
        .setSubtitle(levelLabel + ' - Pitch #' + pitchCount))
      .addSection(CardService.newCardSection()
        .setHeader('Subject')
        .addWidget(CardService.newTextParagraph()
          .setText(result.subject || '(none)')))
      .addSection(CardService.newCardSection()
        .setHeader('Counter Pitch')
        .addWidget(CardService.newTextParagraph()
          .setText(result.body)))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph()
          .setText('Draft created. Check your Drafts folder.')));

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(card.build()))
      .build();

  } catch (err) {
    var errorCard = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('ERROR'))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph()
          .setText(err.message)));

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(errorCard.build()))
      .build();
  }
}

function onResetCounts(e) {
  resetPitchCounts();

  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('RESET'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText('All pitch counts cleared. Everyone starts fresh.')));

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card.build()))
    .build();
}

// ============================================================
// HELPERS
// ============================================================

function getOrCreateLabel(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}
