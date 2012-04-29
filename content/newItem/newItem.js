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
 * The Original Code is Preferences Toolbar 2.
 *
 * The Initial Developer of the Original Code is
 * Aaron Andersen.
 * Portions created by the Initial Developer are Copyright (C) 2___
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Aaron Andersen <aaron@xulplanet.com>
 *                 Manuel Reimer <Manuel.Reimer@gmx.de>
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

var goPrefBar = Components.classes["@prefbar.mozdev.org/goprefbar;1"]
                          .getService().wrappedJSObject;

const gPages = {"check": "newCheck.xul",
                "button": "newButton.xul",
                "menulist": "newMenulist.xul",
                "link": "newLink.xul",
                "text": "newText.xul",
                "separator": "newSeparator.xul",
                "spacer": "newSpacer.xul",
                "extlist": "newExtlist.xul",
                "extcheck": "newExtcheck.xul",
                "submenu": "newSubmenu.xul"};
var gInEditMode;

function Startup() {
  if (!window.arguments) return;

  // Kill the Accesskey "Enter" in the Dialog, to make multiline textboxes
  // possible
  var okButton = document.documentElement.getButton("accept");
  if (okButton) {
    okButton.removeAttribute("default");
    okButton.setAttribute("accesskey","");
  }

  var arg = window.arguments[0];

  gInEditMode = arg.match(/^prefbar:/);

  var type = arg;
  if (gInEditMode) {
    goPrefBar.dump("Editing item id: " + arg);
    type = goPrefBar.JSONUtils.mainDS[arg].type
  }
  else if (type == "spacer" || type == "separator")
    document.documentElement.getButton("extra1").disabled = true;

  goPrefBar.dump("Item type: " + type);

  var page = gPages[type];

  window.frames[0].document.location.href = page;

  goPrefBar.dump("Setting frame to: " + page);

  setupFrame();
}

function setupFrame() {
  var frame = document.getElementById("content-frame");

  if(frame.docShell.busyFlags != frame.docShell.BUSY_FLAGS_NONE) {
    goPrefBar.dump("Frame not loaded");
    setTimeout(setupFrame, 10);
  }
  else {
    goPrefBar.dump("Frame loading complete");
    if (gInEditMode)
      window.frames[0].setupEdit();
    else {
      var idfield = window.frames[0].document.getElementById("itemId");
      if (idfield) idfield.focus();
      window.frames[0].setupNew();
    }
  }
}

function dialogApply() {
  var success = dialogAccept();
  // If the item successfully has been newly created, then switch to edit mode.
  if (success && !gInEditMode) {
    var id = window.frames[0].document.getElementById("itemId").value;
    if (window.arguments[0] == "submenu")
      id = "prefbar:menu:" + id;
    else
      id = "prefbar:button:" + id;
    window.arguments[0] = id;
    Startup();
  }
}

function dialogAccept() {
  if (gInEditMode) {
    if(window.frames[0].verifyData()) {
      window.frames[0].editItem();
      goPrefBar.JSONUtils.MainDSUpdated();
      return true;
    }
  }
  else {
    if(window.frames[0].verifyDataNew()) {
      window.frames[0].createNewItem();
      goPrefBar.JSONUtils.MainDSUpdated("newItem");
      return true;
    }
  }
  return false;
}
