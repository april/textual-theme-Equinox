/* jslint browser: true */
/* global app, Textual */

/* Defined in: "Textual.app -> Contents -> Resources -> JavaScript -> API -> core.js" */

/* Theme-wide preferences, as per milky's request */
var Equinox = {
  fadeNicks: true,            // fade out nicknames when they appear multiple times in a row
  fadeNicksFreq: 10,          // how frequently to display a nick if they have fadeNickCounts lines in a row
  showDateChanges: true,      // show date changes
  squashModes: false,         // if a duplicate mode gets posted to the channel, squash it
  squashTopics: true          // if a duplicate topic gets posted to the channel, squash it
};

/* Set the default statuses for everything tracked in the roomState */
var mappedSelectedUsers = [];
var rs                  = { // room state
  date: {
    year: 0,
    month: 0,
    day: 0
  },
  previousNickCount: 1,
  previousNickDelete: false
};

var NickColorGenerator = (function () {
  'use strict';

  function NickColorGenerator(message) {
    var i, inlineNicks, nick;

    // Start alternative nick colouring procedure
    var selectNick = message.querySelector('.sender');
    selectNick.removeAttribute('colornumber');
    var nickcolor = this.generateColorFromHash(selectNick.getAttribute('nickname'));

    selectNick.style.color = nickcolor;

    inlineNicks = message.querySelectorAll('.inline_nickname');

    if (message.getAttribute('ltype') === 'action') {
      message.querySelector('.message').style.color = nickcolor;
    }

    for (i = 0; i < inlineNicks.length; i++) {
      inlineNicks[i].removeAttribute('colornumber');
      nick = inlineNicks[i].textContent;
      if (inlineNicks[i].getAttribute('mode').length > 0) {
        nick = nick.replace(inlineNicks[i].getAttribute('mode'), '');
      }
      inlineNicks[i].style.color = this.generateColorFromHash(nick);
    }
  }

/*   Attempts to clean up a nickname by removing alternate characters from the end;
     nc_ becomes nc, avidal` becomes avidal */
  NickColorGenerator.prototype.sanitiseNickname = function (nick) {
    nick = nick.toLowerCase();
    nick = nick.replace(/[`_-]+$/, ''); // typically `, _, and - are used on the end of a nick
    nick = nick.replace(/|.*$/, ''); // remove |<anything> from the end
    return nick;
  };

  NickColorGenerator.prototype.generateHashFromNickname = function (nick) {
    var cleaned = this.sanitiseNickname(nick), h = 0, i;

    for (i = 0; i < cleaned.length; i++) {
      h = cleaned.charCodeAt(i) + (h << 6) + (h << 16) - h;
    }
    return h;
  };

  NickColorGenerator.prototype.generateColorFromHash = function (nick) {
    var nickhash = this.generateHashFromNickname(nick);
    var deg      = nickhash % 360;
    var h        = deg < 0 ? 360 + deg : deg;
    var l        = Math.abs(nickhash) % 110;
    var s;

    // don't use the blue and purple hues
    if (h >= 250 && h <= 290) {
      h += 40;
    }
    if (h < 250 && h >= 210) {
      h -= 40;
    }

    // shift the reds into pinks and oranges
    if (h >= 330) {
      h -= 30;
    }
    if (h < 25) {
      h += 25;
    }

    if (h >= 30 && h <= 210) {
      l = 60;
    }

    s = 20 + Math.abs(nickhash) % 70;
    if (h >= 210 && s >= 80) {
      s -= 30;
    }

    if ((h < 110 && s < 60) || (l <= 30)) {
      l += 40;
    }

    if (l > 90) {
      l -= 20;
    }

    // if the saturation is really low, bump up the luminance a bit
    if (s < 40) {
      l += 10;
    }

    return 'hsl(' + h + ',' + s + '%,' + l + '%)';
  };
  return NickColorGenerator;
})();

function isMessageInViewport(elem) {
  'use strict';

  if (!elem.getBoundingClientRect) {
    return true;
  }

  return (elem.getBoundingClientRect().bottom <= document.documentElement.clientHeight);
}

function toggleSelectionStatusForNicknameInsideElement(e) {
  'use strict';
  /* e is nested as the .sender so we have to go three parents
   up in order to reach the parent div that owns it. */
  var parentSelector = e.parentNode.parentNode.parentNode.parentNode;

  parentSelector.classList.toggle('selectedUser');
}

function updateNicknameAssociatedWithNewMessage(e) {
  'use strict';
  /* We only want to target plain text messages. */
  var acceptedElementTypes = ['privmsg', 'action', 'notice'], elementType = e.getAttribute('ltype'), nickname, senderSelector;

  if (acceptedElementTypes.indexOf(elementType) !== -1) {
    /* Get the nickname information. */
    senderSelector = e.querySelector('.sender');
    if (senderSelector) {
      /* Is this a mapped user? */
      nickname = senderSelector.getAttribute('nickname');

      /* If mapped, toggle status on for new message. */
      if (mappedSelectedUsers.indexOf(nickname) > -1) {
        toggleSelectionStatusForNicknameInsideElement(senderSelector);
      }
    }
  }
}

/* Insert a date, if the date has changed from the previous message */
function dateChange(e) {
  'use strict';
  var timestamp, datetime, year, month, day, id;
  var MAXTIMEOFFSET = 30000;  // 30 seconds

  // Only show date changes if the option is enabled
  if (!Equinox.showDateChanges) {
    return;
  }

  timestamp = parseFloat(e.getAttribute('timestamp')) * 1000;
  datetime = new Date(timestamp);

  year = datetime.getFullYear();
  month = datetime.getMonth();
  day = datetime.getDate();
  id = 'date-' + String(year) + '-' + String(month + 1) + '-' + String(day);

  // Occasionally when replaying, Textual will post messages in the future, and then jump backwards
  // As such, we'll ignore all joins and topics, if they're more than MAXTIMEOFFSET milliseconds from the current time
  if (e.getAttribute('ltype') === 'join' || e.getAttribute('ltype') === 'topic') {
    if (Date.now() - timestamp > MAXTIMEOFFSET) {
      return;
    }
  }

  // If the date is the same, then there's nothing to do here
  if (year === rs.date.year && month === rs.date.month && day === rs.date.day) {
    return;
  }

  // First, let's get the last line posted
  var lastline = e.previousSibling;

  // And if it's a mark or a previous date entry, let's remove it, we can use css + selectors for marks that follow
  if (lastline) {
    if (lastline.id === 'mark' || lastline.className === 'date') {
      e.parentNode.removeChild(lastline);
    }
  }

  // Create the date element: <div class="date"><hr /><span>...</span><hr /></div>
  var div = document.createElement('div');
  var span = document.createElement('span');
  div.className = 'date';
  div.id = id;
  div.appendChild(document.createElement('hr'));
  div.appendChild(span);
  div.appendChild(document.createElement('hr'));

  // Set the span's content to the current date (Friday, October 14th)
  span.textContent = datetime.toLocaleDateString();

  // Insert the date before the newly posted message
  e.parentElement.insertBefore(div, e);

  // Update the previous state
  rs.date = {
    year: year,
    month: month,
    day: day
  };
}

/* When you join a channel, delete all the old disconnected messages */
Textual.handleEvent = function (event) {
  'use strict';
  var i, messages;

  if (event === 'channelJoined') {
    messages = document.querySelectorAll('div[command="-100"]');
    for (i = 0; i < messages.length; i++) {
      if (app.channelIsJoined() && (messages[i].getElementsByClassName('message')[0].textContent.search('Disconnect') !== -1)) {
        messages[i].parentNode.removeChild(messages[i]);
      }
    }
  }
};

Textual.newMessagePostedToView = function (line) {
  'use strict';
  var message = document.getElementById('line-' + line);
  var clone, elem, getEmbeddedImages, i, mode, messageText, sender, topic;

  // reset the message count and previous nick, when you rejoin a channel
  if (message.getAttribute('ltype') !== 'privmsg') {
    rs.previousNick = '';
    rs.previousNickCount = 1;
  }

  // call the dateChange() function, for any message with a timestamp
  if (message.getAttribute('timestamp')) {
    dateChange(message);
  }

  // if it's a private message, colorize the nick and then track the state and fade away the nicks if needed
  if (message.getAttribute('ltype') === 'privmsg' || message.getAttribute('ltype') === 'action') {
    sender = message.getElementsByClassName('sender')[0];
    new NickColorGenerator(message); // colorized the nick

    // Delete (ie, make foreground and background color identical) the previous line's nick, if it was set to be deleted
    if (rs.previousNickDelete === true) {
      elem = document.getElementById(rs.previousNickMessageId).getElementsByClassName('sender')[0];
      elem.className += ' f';
      elem.style.color = window.getComputedStyle(elem).backgroundColor;
    }

    // Track the nicks that submit messages, so that we can space out everything
    if ((rs.previousNick === sender.innerHTML) && (rs.previousNickCount < Equinox.fadeNicksFreq)
      && (message.getAttribute('ltype') !== 'action') && (Equinox.fadeNicks === true)) {
      rs.previousNickDelete = true;
      rs.previousNickCount += 1;
    } else {
      rs.previousNick = sender.innerHTML;
      rs.previousNickCount  = 1;
      rs.previousNickDelete = false;
    }

    // Track the previous message's id
    rs.previousNickMessageId = message.getAttribute('id');

    // Copy the message into the hidden history
    clone = message.cloneNode(true);
    clone.removeAttribute('id');
    rs.history.appendChild(clone);

    // Remove old messages, if the history is longer than three messages
    if (rs.history.childElementCount > 2) {
      rs.history.removeChild(rs.history.childNodes[0]);

      // Hide the first nick in the hidden history, if it's the same as the second
      if ((rs.previousNickCount > 1) && (message.getAttribute('ltype') !== 'action')) {
        rs.history.getElementsByClassName('sender')[0].style.visibility = 'hidden';
      }
    }
  }

  /* Let's kill topics that appear where they had already been set before
     This happens when you join a room (like a reconnect) that you had been in and seen the topic before */
  if (Equinox.squashTopics === true && message.getAttribute('ltype') === 'topic') {
    topic = message.getElementsByClassName('message')[0].textContent.replace('Topic is ', '').replace(/\s+/, '');

    if (message.getAttribute('command') === '332') { // an actual topic change
      // hide the topic if it's the same topic again
      if (topic === rs.previousTopic) {
        message.parentNode.removeChild(message);
        rs.previousTopicDeleteSetBy = true;
      }

      rs.previousTopic = topic;
    }

    if ((message.getAttribute('command') === '333') && (rs.previousTopicDeleteSetBy === true)) {
      message.parentNode.removeChild(message);
      rs.previousTopicDeleteSetBy = false;
    }
  }

  // much like we suppress duplicate topics, we want to suppress duplicate modes
  if (Equinox.squashModes === true && message.getAttribute('ltype') === 'mode') {
    mode = message.getElementsByClassName('message')[0].getElementsByTagName('b')[0].textContent;

    if (mode === rs.previousMode) {
      message.parentNode.removeChild(message);
    } else {
      rs.previousMode = mode;
    }
  }

  // hide messages about yourself joining
  if ((message.getAttribute('ltype') === 'join') || (message.getAttribute('ltype') === 'part')) {
    if (message.getElementsByClassName('message')[0].getElementsByTagName('b')[0].textContent === app.localUserNickname()) {
      message.parentNode.removeChild(message);
    }
  }

  /* clear out all the old disconnect messages, if you're currently connected to the channel
     note that normally Textual.handleEvent will catch this, but if you reload a theme, they will reappear */
  if ((message.getAttribute('ltype') === 'debug') && (message.getAttribute('command') === '-100')) {
    if (app.channelIsJoined() &&
        (message.getElementsByClassName('message')[0].textContent.search('Disconnect') !== -1)) {
      message.parentNode.removeChild(message);
    }
  }

  if (message.getAttribute('encrypted') === 'true') {
    messageText = message.querySelector('.innerMessage');
    if (messageText.innerText.indexOf('+OK') !== -1) {
      message.setAttribute('encrypted', 'failed');
    }
  }

  getEmbeddedImages = message.querySelectorAll('img');
  if (getEmbeddedImages) {
    for (i = 0; i < getEmbeddedImages.length; i++) {
      getEmbeddedImages[i].onload = function (e) {
        setTimeout(function () {
          if (e.target.offsetHeight > (window.innerHeight - 150)) {
            e.target.style.height = (window.innerHeight - 150);
          }
        }, 1000);
      };
    }
  }

  updateNicknameAssociatedWithNewMessage(message);
};

/* This is called when a .sender is clicked */
Textual.nicknameSingleClicked = function (e) {
  'use strict';
  var allLines, documentBody, i, sender;
  var nickname = e.getAttribute('nickname');
  var mappedIndex = mappedSelectedUsers.indexOf(nickname);

  if (mappedIndex === -1) {
    mappedSelectedUsers.push(nickname);
  } else {
    mappedSelectedUsers.splice(mappedIndex, 1);
  }

  /* Gather basic information. */
  documentBody = document.getElementById('body_home');

  allLines = documentBody.querySelectorAll('div[ltype="privmsg"], div[ltype="action"]');

  /* Update all elements of the DOM matching conditions. */
  for (i = 0; i < allLines.length; i++) {
    sender = allLines[i].querySelectorAll('.sender');

    if (sender.length > 0) {
      if (sender[0].getAttribute('nickname') === nickname) {

        /* e is nested as the .sender so we have to go three parents
         up in order to reach the parent div that owns it. */
        toggleSelectionStatusForNicknameInsideElement(sender[0]);
      }
    }
  }
};

/* Don't jump back to the bottom of the window when the view becomes visible */
Textual.notifyDidBecomeVisible = function () {
  'use strict';
  window.getSelection().empty();
};

Textual.viewBodyDidLoad = function () {
  'use strict';
  Textual.fadeOutLoadingScreen(1.00, 0.95);

  setTimeout(function () {
    Textual.scrollToBottomOfView();
  }, 500);
};

Textual.viewInitiated = function () {
  'use strict';

  /* When the view is loaded, create a hidden history div which we display if there is scrollback */
  var body = document.getElementById('body_home'), div = document.createElement('div');
  div.id = 'scrolling_history';
  document.getElementsByTagName('body')[0].appendChild(div);
  rs.history = div;

  /* setup the scrolling event to display the hidden history if the bottom element isn't in the viewport
     also hide the topic bar when scrolling */
  window.onscroll = function () {
    var line, lines;
    lines = body.getElementsByClassName('line');
    if (lines.length < 2) {
      return;
    }
    line = lines[lines.length - 1];

    if (isMessageInViewport(line) === false) { // scrollback
      rs.history.style.display = 'inline';
      document.getElementById('topic_bar').style.visibility = 'hidden';
    } else {
      rs.history.style.display = 'none'; // at the bottom
      document.getElementById('topic_bar').style.visibility = 'visible';
    }
  };
};
