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
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Manuel Reimer <manuel.reimer@gmx.de>
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


var goPrefBar = null;
var gMainDS;

const ImportType_Import = 1;
const ImportType_Update = 2;
const ImportType_Reset = 3;

function Init(aGO) {
  goPrefBar = aGO;
  gMainDS = goPrefBar.JSONUtils.mainDS;

  prefbarCheckForUpdate();
}

function Export(aWin, aToExport, aFileObj) {
  if (aToExport.length == 0) return;

  // Which parent menu?
  var parent = "prefbar:menu:enabled";
  if (goPrefBar.ArraySearch(aToExport[0], gMainDS["prefbar:menu:disabled"].items) !== false) parent = "prefbar:menu:disabled";

  // Generate template
  var exportds = {
    "prefbar:info": {
      formatversion: gMainDS["prefbar:info"].formatversion
    }
  };
  exportds[parent] = {items: []};

  // Add export items
  for (var index = 0; index < aToExport.length; index++) {
    var expitemid = aToExport[index];
    var expitem = gMainDS[expitemid];

    // No submenus!
    if (expitem.type == "submenu") continue;

    exportds[expitemid] = expitem;
    exportds[parent].items.push(expitemid);
  }

  goPrefBar.JSONUtils.WriteJSON(aFileObj, exportds);
}

function Import(aWin, aFile, aImportType) {
  if (aImportType == undefined) aImportType = ImportType_Import;
  var menus = {"prefbar:menu:enabled": 1,
               "prefbar:menu:disabled": 1};

  // We don't know what the user tries to import...
  var impds;
  try {
    impds = goPrefBar.JSONUtils.ReadJSON(aFile);
  }
  catch(e) {
    try {
      impds = goPrefBar.RDF.ReadRDF(aFile);
    }
    catch(e) {
      goPrefBar.msgAlert(aWin, goPrefBar.GetString("importexport.properties", "importerrcorrupt"));
      throw(e);
      return false;
    }
  }

  if (!goPrefBar.JSONUtils.CanReadFormat(impds)) {
    goPrefBar.msgAlert(aWin, goPrefBar.GetString("importexport.properties", "importerrversion").replace("$filename", aFile.path));
    return false;
  }

  var overwrite = false;
  // Reset or Update --> overwrite anything without asking
  if (aImportType == ImportType_Reset || aImportType == ImportType_Update)
    overwrite = true;
  // Import by user --> If items already exist, then ask user about what to do
  else {
    var exists = false;
    var noupdatelists = [];
    for (var menuid in menus) {
      if (!impds[menuid]) continue;
      var items = impds[menuid].items;
      for (var childindex = 0; childindex < items.length; childindex++) {
        var childid = items[childindex];
        if (gMainDS[childid]) {
          exists = true;
          if (impds[childid].dontupdatelistitems &&
              gMainDS[childid].dontupdatelistitems)
            noupdatelists.push(childid.replace(/^prefbar:button:/, ""));
        }
      }
    }
    if (exists) {
      var msg = goPrefBar.GetString("importexport.properties", "importquestionoverwrite");
      if (noupdatelists.length > 0)
        msg += "\n(" + goPrefBar.GetString("importexport.properties", "importinfokeptlistitems") + ": " + noupdatelists.join(",") + ")";
      overwrite = goPrefBar.msgYesNo(aWin, msg);
    }
  }

  // Run over all possible menus in btn file
  for (var menuid in menus) {
    if (!impds[menuid]) continue;

    var items = impds[menuid].items;

    for (var childindex = 0; childindex < items.length; childindex++) {
      var childid = items[childindex];

      var impitem = impds[childid];

      // Try to localize imported button
      var niceid = childid.replace(/^prefbar:button:/, "");
      try {
        impitem.label = goPrefBar.GetString("buttons.properties", niceid + ".label");
      } catch(e) {}
      if (impitem.items) {
        for (var index = 0; index < impitem.items.length; index++) {
          try {
            impitem.items[index][0] = goPrefBar.GetString("buttons.properties", niceid + ".optionlabel" + (index + 1));
          } catch(e) {}
        }
      }

      // Item not in main datasource --> Append to menu also used in import ds
      if (!gMainDS[childid])
        gMainDS[menuid].items.push(childid);
      // Item exists in main datasource --> Keep some things based on rules
      else {
        var olditem = gMainDS[childid];

        // If we update, we don't touch the users labels
        if (aImportType == ImportType_Update) impitem.label = olditem.label;

        // We never change the hotkeys, defined by the user
        impitem.hkkey = olditem.hkkey;
        impitem.hkkeycode = olditem.hkkeycode;
        impitem.hkmodifiers = olditem.hkmodifiers;

        // We don't edit listitems, if the "DontUpdateListItems"-flag is set
        // in the main datasource *and* in the import datasource
        if (impitem.dontupdatelistitems && olditem.dontupdatelistitems)
          impitem.items = olditem.items;
      }

      // Store imported item
      gMainDS[childid] = impitem;
    }
  }

  goPrefBar.JSONUtils.MainDSUpdated();
  return true;
}

function prefbarCheckForUpdate() {
  var savedVersion = goPrefBar.GetPref("extensions.prefbar.version", 0);
  if (savedVersion < goPrefBar.prefbarVersion) {
    goPrefBar.openPrefBarHP = true;
    Import(null, "chrome://prefbar/content/prefbar.json", ImportType_Update);
  }

  goPrefBar.SetPref("extensions.prefbar.version", goPrefBar.prefbarVersion);
}
