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
 * The Initial Developer of the Original Code is Manuel Reimer.
 *
 * Portions created by the Initial Developer are Copyright (C) 2011
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

// Globals
var goPrefBar = null;
var gMainDSFile = null;
var gFormatVersion = null;

var mainDS = {};         // Property for outside access. Holds main datasource

function Init(aGO) {
  goPrefBar = aGO;

  // Get FormatVersion from builtin json datasource
  var internalds = ReadJSON("chrome://prefbar/content/prefbar.json");
  gFormatVersion = internalds["prefbar:info"].formatversion;

  // Get profile dir
  var dirservice = Components.classes["@mozilla.org/file/directory_service;1"]
    .getService(Components.interfaces.nsIProperties);
  var profdir = dirservice.get("ProfD", Components.interfaces.nsIFile);

  // Generate paths to json and rdf datasources
  gMainDSFile = profdir.clone();
  gMainDSFile.append("prefbar.json");
  var prefbarrdf = profdir.clone();
  prefbarrdf.append("prefbar.rdf");

  // "Something" exists in profile
  if (gMainDSFile.exists() || prefbarrdf.exists()) {
    mainDS = gMainDSFile.exists() ? ReadJSON(gMainDSFile) : goPrefBar.RDF.ReadRDF(prefbarrdf);
    if (!CanReadFormat(mainDS)) {
      goPrefBar.msgAlert(null, goPrefBar.GetString("rdf.properties", "cantreadformat") + "\n\n" + gMainDSFile.path);
      mainDS = null;
      return;
    }
  }
  // Nothing exists, that could be loaded --> Create skeleton json
  // ImportExport fills this in "Init". Internal DS has to be loaded this way
  // for "buttons.properties" to take effect.
  else {
    mainDS = {
      "prefbar:menu:enabled": {items: []},
      "prefbar:menu:disabled": {items: []},
      "prefbar:info": {formatversion: gFormatVersion}
    }
  }

  // Get sure we have a "prefbar.json" in profile
  if (!gMainDSFile.exists()) WriteJSON(gMainDSFile, mainDS);
}

function MainDSUpdated(aSource) {
  // Notify anyone about the datasource change
  goPrefBar.ObserverService.notifyObservers(null, "extensions-prefbar-json-changed", aSource)

  // Flush datasource file to hard drive
  WriteJSON(gMainDSFile, mainDS);
}

function ReadJSON(aFile) {
  var istream;
  if (typeof aFile == "string") {
    var ios = Components.classes["@mozilla.org/network/io-service;1"]
      .getService(Components.interfaces.nsIIOService);
    var channel = ios.newChannel(aFile, null, null);
    istream = channel.open();
  }
  else {
    istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
      .createInstance(Components.interfaces.nsIFileInputStream);
    istream.init(aFile, -1, -1, false);
  }

  var sstream = Components.classes["@mozilla.org/scriptableinputstream;1"]
    .createInstance(Components.interfaces.nsIScriptableInputStream);
  sstream.init(istream);

  var jsonstr = "";
  var buffer = "";
  do {
    buffer = sstream.read(1024);
    jsonstr += buffer;
  } while(buffer != "");

  sstream.close();
  istream.close();

  // Only *try* to parse input string as UTF-8. If this fails, then we still
  // have the already read string and can expect it to be ANSI
  try {
    var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
      .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    jsonstr = converter.ConvertToUnicode(jsonstr);
  } catch(e) {}

  return JSON.parse(jsonstr);
}

function WriteJSON(aFileObj, aJSON) {
  var jsonstr = JSON.stringify(aJSON, null, 2);
  jsonstr = jsonstr.replace(/\\u000a/g, "\\n");
  jsonstr += "\n";

  var os = Components.classes["@mozilla.org/network/file-output-stream;1"]
    .createInstance(Components.interfaces.nsIFileOutputStream);
  os.init(aFileObj, 0x02|0x08|0x20, parseInt("00640", 8), 0);
                    // write, create, truncate

  var cstream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
    .createInstance(Components.interfaces.nsIConverterOutputStream);
  cstream.init(os, "UTF-8", 0, 0);

  cstream.writeString(jsonstr);

  cstream.close();
  os.close();
}

function CanReadFormat(aDS) {
  var info = aDS["prefbar:info"];
  return (info &&
          info.formatversion &&
          info.formatversion >= 3 &&  // First used JSON datasource version
          info.formatversion <= gFormatVersion); // Current DS version
}

function GetAnonymousID() {
  var uuidGenerator = Components.classes["@mozilla.org/uuid-generator;1"]
    .getService(Components.interfaces.nsIUUIDGenerator);
  var id;
  do {
    var uuid = uuidGenerator.generateUUID();
    id = "prefbar:button:" + uuid.toString();
  } while (id in mainDS);
  return id;
}

function CheckNewID(aWin, aID) {
  if (aID in mainDS) {
    goPrefBar.msgAlert(aWin, goPrefBar.GetString("newItem.properties", "alertidinuse"));
    return false;
  }
  return true;
}
