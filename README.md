# [moz-prefbar](https://github.com/warren-bank/moz-prefbar)

Fork of the Firefox add-on: _PrefBar_

## Summary

* Forked from [v6.5.0 of "PrefBar"](http://git.tuxfamily.org/prefbar/main.git?p=prefbar/main.git;a=commit;h=refs/tags/v6.5.0) by [Manuel Reimer](https://addons.mozilla.org/en-US/firefox/user/manuel-reimer/)
  * [project home](http://prefbar.tuxfamily.org/)
  * [git repo](http://git.tuxfamily.org/prefbar/main.git)

    > `git clone git://git.tuxfamily.org/gitroot/prefbar/main.git`
  * [AMO](https://addons.mozilla.org/en-US/firefox/addon/prefbar/)

## [Credits](http://prefbar.tuxfamily.org/help/credits.html)

* Original Concept: [Matthew Thomas](http://mpt.phrasewise.com/) ( via [bug 38521](http://bugzilla.mozilla.org/show_bug.cgi?id=38521) )
* Inital developer: Aaron Andersen
* Project Owner: [Manuel Reimer](mailto:manuel.reimer@gmx.de)
* Japanese translation: [Norah Marinkovic](http://norahmodel.exblog.jp/)

## About

_PrefBar_ started as a simple toolbar to get easy access to common preferences like Javascript, Flash, the proxy used for web access, &hellip; Over the time, PrefBar got further developed to be a container for nearly everything, that can be placed on a button, checkbox or menulist.

All items may be placed and grouped freely on PrefBar's bar. The bar itself may be moved using the browser built-in "toolbar customize" feature to anywhere you like (even in foreign toolbars, next to the menubar, &hellip;).

## Comments

* The purpose for this fork is two-fold
  1. this is an awesome add-on, and I wanted to keep a backup of its source
  2. though its export/import functionality allows full backup/restore of menu items, it doesn't appear to support _submenu_ groupings. I'd like to add [a branch](https://github.com/warren-bank/moz-prefbar/tree/submenu_persistence) to include this feature.

* The __About__ description (copied verbatim) seems to gloss over what this add-on actually does.
  * it provides the ability for a user to customize what form field elements appear on its toolbar, or dropdown menu when added as an element of another toolbar
  * the purpose of each form field is to allow the user the ability to quickly access and change the value of arbitrary _preferences_. Such _preferences_ would normally only be accessible either through the `about:config` tab, or possibly through the _options_ dialog window for another add-on.

* The Mozilla add-ons that I've written tend to have minimal UI. I don't like clutter. All of the _preferences_ that I decide a (normal) user should be able to access are (typically) contained only within the corresponding add-on's _options_ dialog window. Sometimes, these _preferences_ include checkboxes to toggle whether or not certain features are enabled. Sometimes, users will comment that they would like additional UI chrome to be able to access these checkboxes more quickly and directly. Rather than including this in the add-on(s), I believe that _PrefBar_ is a much better general-purpose utility for adding this additional UI chrome. Each add-on can instruct users to a link from which they can obtain a _PrefBar_ import file, which contains the configuration data that describes a submenu&hellip; and a set of checkbox fields within this submenu that can each be used to quickly toggle the corresponding (boolean) _preference_ value.

## [License](http://prefbar.tuxfamily.org/help/credits.html)

* The PrefBar is released under the MPL/GPL/LGPL tri-license.<br>
  (See any of the source files for details.)<br>
  You may freely use it in any manner compatible with that license.

* Version: MPL 1.1/GPL 2.0/LGPL 2.1

  > [MPL v1.1](https://www.mozilla.org/MPL/1.1/index.txt)<br>
  > [GPL v2.0](http://www.gnu.org/licenses/gpl-2.0.txt)<br>
  > [LGPL v2.1](http://www.gnu.org/licenses/lgpl-2.1.txt)

* Copyright (c) 2002-2009, Manuel Reimer
