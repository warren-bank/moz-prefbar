/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Preferences Toolbar 4.
 *
 * The Initial Developer of the Original Code is
 * Manuel Reimer <manuel.reimer@gmx.de>.
 * Portions created by the Initial Developer are Copyright (C) 2002-2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Manuel Reimer <manuel.reimer@gmx.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/***********************************************************
class definition
***********************************************************/

// Raw template for "goPrefBar" object. Here, it's only prepared with a
// good "Include" function (one, which logs pretty debug messages to console).
// All the other parts are included from content/prefbar.js
var objgoprefbar = {
  Include: function(asURL, aoContext) {
    var oLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
      .getService(Components.interfaces.mozIJSSubScriptLoader);
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
      .getService(Components.interfaces.nsIConsoleService);
    var scriptError = Components.classes["@mozilla.org/scripterror;1"]
      .createInstance(Components.interfaces.nsIScriptError);
    try {
      oLoader.loadSubScript(asURL, aoContext);
      return true;
    }
    catch(e) {
      scriptError.init(e.message,
                       e.fileName,
                       null,
                       e.lineNumber,
                       null,
                       2,
                       null);
      consoleService.logMessage(scriptError);
      return false;
    }
  }
};

//class constructor
function GoPrefBar() {
  // Anything, this component does, is to load the global PrefBar stuff
  // into global context
  objgoprefbar.Include("chrome://prefbar/content/prefbar.js", objgoprefbar);
  objgoprefbar.Init();
  this.wrappedJSObject = objgoprefbar;
}

// class definition
GoPrefBar.prototype = {
  classDescription: "PrefBar Global Object Component",
  classID:          Components.ID("{830a2ec4-be0d-4592-8397-ff794b476f28}"),
  contractID:       "@prefbar.mozdev.org/goprefbar;1",
  QueryInterface:   XPCOMUtils.generateQI([Components.interfaces.nsISupports]),
};

/***********************************************************
module initialization
***********************************************************/

if (XPCOMUtils.generateNSGetFactory)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([GoPrefBar]);
else
  var NSGetModule = XPCOMUtils.generateNSGetModule([GoPrefBar]);
