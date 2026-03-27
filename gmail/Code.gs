/**
 * Counter Pitch - Gmail Integration
 *
 * Google Apps Script that scans for cold pitch emails,
 * generates counter-pitches via the Counter Pitch API,
 * and creates draft replies in Gmail.
 *
 * Setup:
 * 1. Open script.google.com, create a new project
 * 2. Paste this code into Code.gs
 * 3. Set script properties (File > Project settings > Script properties):
 *    - API_URL: https://counter-pitch-idealift.azurewebsites.net
 *    - API_KEY: (your SITE_API_KEY value)
 * 4. Run setupTrigger() once to create the 5-minute timer
 * 5. Authorize when prompted
 */

// ============================================================
// CONFIGURATION
// ============================================================

var COLD_PITCH_KEYWORDS = [
  'quick call',
  'partnership opportunity',
  'reaching out',
  'I noticed your company',
  'would love to connect',
  'I came across',
  'boost your',
  'grow your',
  'increase your revenue',
  'schedule a demo',
  'free audit',
  'free trial',
  'we help companies',
  'we specialize in',
  'I wanted to reach out',
  'are you the right person',
  'just following up',
  'checking in on my last email',
  'I tried reaching you',
  'quick question for you',
  'we work with companies like',
  'I saw that you',
  'thought you might be interested',
  'limited time offer',
  'exclusive opportunity',
  'scale your',
  'transform your',
  'revolutionize your',
  'take your business to the next level'
];

var LABEL_NAME = 'counter-pitched';
var SEARCH_NEWER_THAN = '1d';

// ============================================================
// MAIN
// ============================================================

/**
 * Run once to set up the recurring trigger.
 */
function setupTrigger() {
  // Remove existing triggers to avoid duplicates
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
  var query = 'is:unread -from:me -label:' + LABEL_NAME + ' newer_than:' + SEARCH_NEWER_THAN;

  var threads = GmailApp.search(query, 0, 20);

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();
    var lastMessage = messages[messages.length - 1];

    var body = lastMessage.getPlainBody();
    var from = lastMessage.getFrom();

    if (!isColdPitch(body, from)) {
      continue;
    }

    var senderInfo = parseSender(from);
    var pitchCount = incrementPitchCount(senderInfo.key);

    try {
      var result = callCounterPitchAPI({
        senderName: senderInfo.name,
        senderCompany: senderInfo.company,
        websiteUrl: '',
        emailText: body,
        pitchCount: pitchCount
      });

      if (result && result.body) {
        var subject = result.subject || ('Re: ' + lastMessage.getSubject());
        if (!subject.toLowerCase().startsWith('re:')) {
          subject = 'Re: ' + lastMessage.getSubject();
        }

        thread.createDraftReply(result.body, {
          subject: subject
        });

        thread.addLabel(label);

        Logger.log('Draft created for: ' + from + ' (pitch #' + pitchCount + ', level ' + result.level + ')');
      }
    } catch (e) {
      Logger.log('Error processing ' + from + ': ' + e.message);
    }
  }
}

// ============================================================
// COLD PITCH DETECTION
// ============================================================

/**
 * Heuristic check: does this email look like a cold pitch?
 */
function isColdPitch(body, from) {
  // Skip emails from known contacts (customize this list)
  var trustedDomains = getTrustedDomains();
  var fromDomain = extractDomain(from);
  if (trustedDomains.indexOf(fromDomain) !== -1) {
    return false;
  }

  var lowerBody = body.toLowerCase();
  var matchCount = 0;

  for (var i = 0; i < COLD_PITCH_KEYWORDS.length; i++) {
    if (lowerBody.indexOf(COLD_PITCH_KEYWORDS[i].toLowerCase()) !== -1) {
      matchCount++;
    }
  }

  // Need at least 2 keyword matches to flag as cold pitch
  return matchCount >= 2;
}

/**
 * Get trusted domains that should never be flagged.
 * Add your own domains here.
 */
function getTrustedDomains() {
  return [
    'idealift.app',
    'gmail.com',
    // Add more trusted domains
  ];
}

// ============================================================
// SENDER PARSING
// ============================================================

/**
 * Parse sender info from Gmail "From" header.
 * Format: "Name <email@domain.com>" or just "email@domain.com"
 */
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
  // Capitalize first letter
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

/**
 * Get and increment the pitch count for a sender.
 * Uses PropertiesService for persistence across runs.
 */
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
// API
// ============================================================

/**
 * Call the Counter Pitch sync API.
 */
function callCounterPitchAPI(params) {
  var props = PropertiesService.getScriptProperties();
  var apiUrl = props.getProperty('API_URL');
  var apiKey = props.getProperty('API_KEY');

  if (!apiUrl || !apiKey) {
    throw new Error('API_URL and API_KEY must be set in Script Properties');
  }

  var url = apiUrl.replace(/\/$/, '') + '/api/counter-pitch/sync';

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey
    },
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

// ============================================================
// GMAIL ADD-ON (Phase 2)
// ============================================================

/**
 * Add-on homepage trigger.
 */
function onHomepage(e) {
  return createHomepageCard();
}

/**
 * Add-on contextual trigger: fires when user opens a message.
 */
function onGmailMessage(e) {
  var messageId = e.gmail.messageId;
  var accessToken = e.gmail.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);

  var message = GmailApp.getMessageById(messageId);
  var from = message.getFrom();
  var body = message.getPlainBody();
  var senderInfo = parseSender(from);
  var currentCount = getPitchCount(senderInfo.key);

  return createMessageCard(senderInfo, body, currentCount, messageId);
}

function createHomepageCard() {
  var props = PropertiesService.getUserProperties();
  var counts = JSON.parse(props.getProperty('pitchCounts') || '{}');
  var total = Object.keys(counts).length;

  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('COUNTER PITCH')
      .setSubtitle('They pitch you. Tom pitches back harder.'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText('Tracked senders: ' + total))
      .addWidget(CardService.newTextButton()
        .setText('RESET PITCH COUNTS')
        .setOnClickAction(CardService.newAction()
          .setFunctionName('onResetCounts'))));

  return card.build();
}

function createMessageCard(senderInfo, body, currentCount, messageId) {
  var chaosLabel = currentCount === 0 ? 'REAL MODE (first pitch)' :
                   currentCount === 1 ? 'CHAOS MODE (pitch #2)' :
                   'UNHINGED MODE (pitch #' + (currentCount + 1) + ')';

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
        .setContent(String(currentCount)))
      .addWidget(CardService.newTextButton()
        .setText('FIRE BACK')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(CardService.newAction()
          .setFunctionName('onFireBack')
          .setParameters({
            senderName: senderInfo.name,
            senderCompany: senderInfo.company,
            senderKey: senderInfo.key,
            emailBody: body.substring(0, 5000),
            messageId: messageId
          }))));

  return card.build();
}

/**
 * Handle "FIRE BACK" button click.
 */
function onFireBack(e) {
  var params = e.commonEventObject.parameters;
  var pitchCount = incrementPitchCount(params.senderKey);

  try {
    var result = callCounterPitchAPI({
      senderName: params.senderName,
      senderCompany: params.senderCompany,
      websiteUrl: '',
      emailText: params.emailBody,
      pitchCount: pitchCount
    });

    var levelLabel = result.level === 1 ? 'REAL MODE' :
                     result.level === 2 ? 'CHAOS MODE' : 'UNHINGED MODE';

    // Create draft reply
    var message = GmailApp.getMessageById(params.messageId);
    var thread = message.getThread();
    var subject = result.subject || ('Re: ' + message.getSubject());

    thread.createDraftReply(result.body, { subject: subject });

    // Label the thread
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
