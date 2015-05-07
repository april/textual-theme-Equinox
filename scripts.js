/* jslint browser: true */
/* global Textual */

/* Defined in: "Textual.app -> Contents -> Resources -> JavaScript -> API -> core.js" */

var mappedSelectedUsers = [];
var rs = {}; // room state

/* Set the default statuses for everything tracked in the roomState */
rs.previousNickCount = 1;
rs.previousNickDelete = false;

// var previousNick = '', previousNickCount = 1, previousNickMessageId, previousNickDelete = false;

var NickColorGenerator = (function () {
    function NickColorGenerator(message) {
        //Start alternative nick colouring procedure
        var elem;
        var selectNick = message.querySelector(".sender");
        selectNick.removeAttribute('colornumber');
        var nickcolor = this.generateColorFromHash(selectNick.getAttribute('nickname'));

        selectNick.style.color = nickcolor;

        var inlineNicks = message.querySelectorAll('.inline_nickname');
        if (message.getAttribute('ltype') == 'action') {
            message.querySelector(".message").style.color = nickcolor;
        }
        for (var i = 0, len = inlineNicks.length; i < len; i++) {
            inlineNicks[i].removeAttribute('colornumber');
            var nick = inlineNicks[i].innerHTML;
            if (inlineNicks[i].getAttribute('mode').length > 0) {
                nick = nick.replace(inlineNicks[i].getAttribute('mode'), '');
            }
            inlineNicks[i].style.color = this.generateColorFromHash(nick);
        }
    }
    NickColorGenerator.prototype.sanitiseNickname = function (nick) {
        // attempts to clean up a nickname
        // by removing alternate characters from the end
        // nc_ becomes nc, avidal` becomes avidal
        nick = nick.toLowerCase();
        // typically ` and _ are used on the end alone
        nick = nick.replace(/[`_]+$/, '');
        // remove |<anything> from the end
        nick = nick.replace(/|.*$/, '');
        return nick;
    };

    NickColorGenerator.prototype.generateHashFromNickname = function (nick) {
        var cleaned = this.sanitiseNickname(nick);
        var h = 0;
        for(var i = 0; i < cleaned.length; i++) {
            h = cleaned.charCodeAt(i) + (h << 6) + (h << 16) - h;
        }
        return h;
    };

    NickColorGenerator.prototype.generateColorFromHash = function (nick) {
        var nickhash = this.generateHashFromNickname(nick);
        var deg = nickhash % 360;
        var h = deg < 0 ? 360 + deg : deg;
        var l = Math.abs(nickhash) % 110;

        // don't use the blue hues
        if (h >= 240 && h <= 270) {
          h += 30;
        }
        if (h < 240 && h >= 210) {
          h -= 30;
        }

        // shift the reds into pinks and oranges
        if (h >= 330) {
          h -= 30;
        }
        if (h < 25) {
          h += 25;
        }

        if(h >= 30 && h <= 210) {
            l = 60;
        }
        var s = 20 + Math.abs(nickhash) % 70;
        if (h >= 210 && s >= 80) {
            s = s-30;
        }
        if ((h < 110 && s < 60) || l <= 30) {
            l = l + 40;
        }
        if (l > 90) {
            l = l - 20;
        }

        // if the saturation is really low, bump up the luminance a bit
        if (s < 40) {
          l += 10;
        }

        return "hsl(" + h + "," + s + "%," + l + "%)";
    };
    return NickColorGenerator;
})();

Textual.viewBodyDidLoad = function() {
    Textual.fadeOutLoadingScreen(1.00, 0.95);

    setTimeout(function() {
        Textual.scrollToBottomOfView();
    }, 500);
};

Textual.newMessagePostedToView = function (line) {
    'use strict';
    var message = document.getElementById('line-' + line);
    var elem, mode, sender, topic;

    // reset the message count and previous nick, when you rejoin a channel
    if (message.getAttribute('ltype') !== 'privmsg') {
      rs.previousNick = '';
      rs.previousNickCount = 1;
    }

    // if it's a private message, colorize the nick and then track the state and fade away the nicks if needed
	if (message.getAttribute('ltype') === 'privmsg' || message.getAttribute('ltype') === 'action') {
      sender = message.getElementsByClassName('sender')[0];
      new NickColorGenerator(message); // colorized the nick

      // Delete (ie, make foreground and background color identical) the previous line's nick, if it was set to be deleted
      if (rs.previousNickDelete === true) {
        elem = document.getElementById(rs.previousNickMessageId).getElementsByClassName('sender')[0];
        elem.className += ' f';
        elem.style.color = window.getComputedStyle(elem).backgroundColor;
      }

      // Track the nicks that submit messages, so that we can space out everything
      if ((rs.previousNick === sender.innerHTML) && (rs.previousNickCount < 10) && (message.getAttribute('ltype') !== 'action')) {
        rs.previousNickDelete = true;
        rs.previousNickCount += 1;
      } else {
        rs.previousNick = sender.innerHTML;
        rs.previousNickCount = 1;
        rs.previousNickDelete = false;
      }

      // Track the previous message's id
      rs.previousNickMessageId = message.getAttribute('id');
    }

    /* Let's kill topics that appear where they had already been set before
       This happens when you join a room (like a reconnect) that you had been in and seen the topic before */
    if (message.getAttribute('ltype') === 'topic') {
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
    if (message.getAttribute('ltype') === 'mode') {
      mode = message.getElementsByClassName('message')[0].getElementsByTagName('b')[0].textContent;

      if (mode === rs.previousMode) {
        message.parentNode.removeChild(message);
      } else {
        rs.previousMode = mode;
      }
    }

    // hide messages about yourself joining
    if (message.getAttribute('ltype') === 'join') {
      if (message.getElementsByClassName('message')[0].getElementsByTagName('b')[0].textContent === app.localUserNickname()) {
        message.parentNode.removeChild(message);
      }
    }

    // clear out all the old disconnect messages, if you're currently connected to the channel
    if ((message.getAttribute('ltype') === 'debug') && (message.getAttribute('command') === '-100')) {
      if (app.channelIsJoined() && (message.getElementsByClassName('message')[0].textContent.search('Disconnect') !== -1)) {
        message.parentNode.removeChild(message);
      }
    }

    if (message.getAttribute("encrypted") === "true") {
        var messageText = message.querySelector(".innerMessage");
        if (messageText.innerText.indexOf("+OK") !== -1) {
            message.setAttribute("encrypted", "failed");
        }
    }
    var getEmbeddedImages = message.querySelectorAll("img");
    if (getEmbeddedImages) {
        for (var i = 0, len = getEmbeddedImages.length; i < len; i++) {
            getEmbeddedImages[i].onload = function(e) {
                setTimeout(function() {
                    if (e.target.offsetHeight > (window.innerHeight - 150)) {
                        e.target.style.height = (window.innerHeight - 150);
                    }
                }, 1000);
            }
        }
    }
    updateNicknameAssociatedWithNewMessage(message);
};

Textual.nicknameSingleClicked = function(e) {
    userNicknameSingleClickEvent(e);
}

Textual.notifyDidBecomeVisible = function()
{
  window.getSelection().empty();
};


function updateNicknameAssociatedWithNewMessage(e) {
	/* We only want to target plain text messages. */
	var elementType = e.getAttribute("ltype");
    var acceptedElementTypes = ["privmsg", "action", "notice"];
	if (acceptedElementTypes.indexOf(elementType) !== -1) {
		/* Get the nickname information. */
		var senderSelector = e.querySelector(".sender");
		if (senderSelector) {
			/* Is this a mapped user? */
			var nickname = senderSelector.getAttribute("nickname");

			/* If mapped, toggle status on for new message. */
			if (mappedSelectedUsers.indexOf(nickname) > -1) {
				toggleSelectionStatusForNicknameInsideElement(senderSelector);
			}
		}
	}
}

function toggleSelectionStatusForNicknameInsideElement(e) {
	/* e is nested as the .sender so we have to go three parents
	 up in order to reach the parent div that owns it. */
	var parentSelector = e.parentNode.parentNode.parentNode.parentNode;

	parentSelector.classList.toggle("selectedUser");
}

function userNicknameSingleClickEvent(e) {
	/* This is called when the .sender is clicked. */
	var nickname = e.getAttribute("nickname");
	/* Toggle mapped status for nickname. */
	var mappedIndex = mappedSelectedUsers.indexOf(nickname);

	if (mappedIndex == -1) {
		mappedSelectedUsers.push(nickname);
	} else {
		mappedSelectedUsers.splice(mappedIndex, 1);
	}

	/* Gather basic information. */
    var documentBody = document.getElementById("body_home");

    var allLines = documentBody.querySelectorAll('div[ltype="privmsg"], div[ltype="action"]');

	/* Update all elements of the DOM matching conditions. */
    for (var i = 0, len = allLines.length; i < len; i++) {
        var sender = allLines[i].querySelectorAll(".sender");

        if (sender.length > 0) {
            if (sender[0].getAttribute("nickname") === nickname) {
				toggleSelectionStatusForNicknameInsideElement(sender[0]);
            }
        }
    }
}
