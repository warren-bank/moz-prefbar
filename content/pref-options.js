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
 * The Original Code is Preferences Toolbar 3.
 *
 * The Initial Developer of the Original Code is
 * Manuel Reimer.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Manuel Reimer <Manuel.Reimer@gmx.de>
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

function Startup() {
  SetButtons();
}

function SetButtons() {
  var webimport = goPrefBar.GetPref("extensions.prefbar.website_import");
  document.getElementById("PrefBarManagePermissions").disabled = !webimport;
}

function resetButton() {
  var resetwanted = goPrefBar.msgYesNo(window, goPrefBar.GetString("pref-options.properties", "questionreset"));
  if (resetwanted) {
    goPrefBar.ImpExp.Import(window, "chrome://prefbar/content/prefbar.json", goPrefBar.ImpExp.ImportType_Reset);
    goPrefBar.msgAlert(window, goPrefBar.GetString("pref-options.properties", "resetfinished"));

    // If editbar pane exists and is loaded, then re-render trees on it
    var editbar_pane = document.getElementById("prefbar_editbar_pane");
    if (editbar_pane && editbar_pane.RenderBothTrees)
      editbar_pane.RenderBothTrees();
  }
}

function ManageImportPerms() {
  var params = {
    prefilledHost: "",
    blockVisible: false,
    sessionVisible: false,
    allowVisible: true,
    permissionType: "extensions-prefbar-webimport",
    introText: goPrefBar.GetString("pref-options.properties", "permmgrintro"),
    windowTitle: goPrefBar.GetString("pref-options.properties", "permmgrtitle")
  }

  var permmgr_url = goPrefBar.InFF() ?
    "chrome://browser/content/preferences/permissions.xul" :
    "chrome://communicator/content/permissions/permissionsManager.xul";
  window.openDialog(permmgr_url,
                    "prefbar:webimportpermissions",
                    "chrome,titlebar,dialog,modal,resizable",
                    params);
}

function ReadHotkey(aField) {
  var pref = document.getElementById("extensions.prefbar.hktoggle");
  var hkarr = pref.value.split("][");
  if (hkarr.length != 3) return;
  aField.modifiers = hkarr[0];
  aField.key = hkarr[1];
  aField.keycode = hkarr[2];
  aField.update();
}

function WriteHotkey(aField) {
  return aField.modifiers + "][" + aField.key + "][" + aField.keycode;
}
