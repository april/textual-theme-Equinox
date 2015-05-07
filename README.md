textual-theme-technical
=======================

A massive overhaul of the nox theme for Textual 5:

![Preview Image](http://i.imgur.com/xgOvbEA.png)
(with Monaco 11pt, the recommended font)

**technical** includes the following changes:
* Update the nick color generation to avoid garish/high-contrast colors (red on black), or low-contrast (dark blue on black).
* Nick consolidation, where consecutive message from the same person only cause their nick to appear once. Similarly, it will squash repeated topics (which happens on frequent reconnects), and repeated modes. It should also hide self-join/part messages, and automatically clear away old disconnect messages once you reconnect to a channel.
* Update the stylesheet to make the text mildly less contrasty (more black to background, more gray to text), and dozens of other style tweaks.
* Disabling the default behavior of Textual to jump down to the bottom of a view (channel) when it becomes active.

## Install Instructions (Local):  
1. Download the the theme by clicking the "Download Zip" button on the right-hand side.  
2. Unzip the the compressed file.   
3. Copy the resulting folder to the following location: [~/Library/Group Containers/8482Q6EPL6.com.codeux.irc.textual/Library/Application Support/Textual/Styles/](file://~/Library/Group Containers/8482Q6EPL6.com.codeux.irc.textual/Library/Application Support/Textual/Styles/)
   
## Install Instructions (iCloud):  
1. Download the the theme by clicking the "Download Zip" button on the right-hand side.  
2. Unzip the the compressed file.  
3. Open iCloud Drive in Finder by going to Go -> iCloud Drive (Or pressing ⌘⇧i).  
4. Click the "Textual IRC Client" folder inside.   
5. Copy the folder from the compressed file into the "Styles" folder within.   

