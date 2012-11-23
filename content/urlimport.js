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
 * Manuel Reimer <manuel.reimer@gmx.de>.
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

var goPrefBar = Components.classes["@prefbar.mozdev.org/goprefbar;1"]
                          .getService().wrappedJSObject;

var gURL;
var gHashType;
var gChecksum;
var gDownloader;
var gTempfile;

function onLoad() {
  var url = window.arguments[0];
  var success = parseurl(url);
  if (!success) {
    window.close();
    return;
  }

  var fname = document.getElementById("nameField");
  var furl = document.getElementById("urlField");
  var fmd5 = document.getElementById("md5Field");
  fname.value = gURL.fileName;
  furl.value = gURL.spec;
  if (gHashType) fmd5.value = gHashType.toUpperCase();

  var aButton = document.documentElement.getButton("accept");
  aButton.setAttribute("label", goPrefBar.GetString("urlimport.properties", "import"));
  aButton.setAttribute("disabled", true);

  // start timer to re-enable buttons
  var delayInterval = 2000;
  setTimeout(reenableInstallButtons, delayInterval);
}

function reenableInstallButtons() {
  document.documentElement.getButton("accept").setAttribute("disabled", false);
}


function cleanup() {
  if (gDownloader) gDownloader.cancelSave();
  gDownloader = undefined;
  if (gTempfile) gTempfile.remove(false);
  return true;
}


// Called by "Import" button
function doDownload() {
  var dirService = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
  var tempfile = dirService.get("TmpD", Components.interfaces.nsILocalFile);
  tempfile.append("prefbarurlimport.rdf");
  tempfile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, parseInt("00600", 8));
  gTempfile = tempfile;

  // update window
  var deck = document.getElementById("deck");
  deck.selectedIndex = 1;
  var aButton = document.documentElement.getButton("accept");
  aButton.setAttribute("disabled", true);
  var info = document.getElementById("importInfo");
  info.value = goPrefBar.GetString("urlimport.properties", "infodownloading");
  var infoicon = document.getElementById("infoicon");
  infoicon.setAttribute("class", "message-icon");

  //new persitence object
  gDownloader = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Components.interfaces.nsIWebBrowserPersist);
  gDownloader.progressListener = new PersistProgressListener;

  //save file to target
  gDownloader.saveURI(gURL,null,null,null,null,gTempfile,null);

  return false;
}

// Called by ProgressListener after finishing download
function downloadDone(status) {
  var info = document.getElementById("importInfo");
  var progress = document.getElementById("progress");
  progress.mode = "undetermined";
  progress.value = 0;

  if (status > 0) {
    goPrefBar.msgAlert(window, goPrefBar.GetString("urlimport.properties", "msgdownloadfailed"));
    cleanup();
    window.close();
    return;
  }

  if (gChecksum) {
    var valid = checkChecksum(gTempfile, gHashType, gChecksum);
    if (!valid) {
      goPrefBar.msgAlert(window, goPrefBar.GetString("urlimport.properties", "msgmd5failed"));
      cleanup();
      window.close();
      return;
    }
  }

  info.value = goPrefBar.GetString("urlimport.properties", "infoimporting");
  var fpService = Components.classes["@mozilla.org/network/protocol;1?name=file"].getService(Components.interfaces.nsIFileProtocolHandler);
  var furl = fpService.getURLSpecFromFile(gTempfile);
  goPrefBar.ImpExp.Import(window, furl);

  goPrefBar.msgAlert(window, goPrefBar.GetString("urlimport.properties", "msgsuccess"));
  cleanup();
  window.close();
}

function checkChecksum(aPath, aHashType, aChecksum) {
  var ch = Components.classes["@mozilla.org/security/hash;1"]
                     .createInstance(Components.interfaces.nsICryptoHash);
  switch (aHashType) {
  case "md5":
    ch.init(ch.MD5);
    break;
  case "sha1":
    ch.init(ch.SHA1);
    break;
  case "sha256":
    ch.init(ch.SHA256);
    break;
  default:
    return false;
  }

  var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
    .createInstance(Components.interfaces.nsIFileInputStream);
  // open for reading
  istream.init(aPath, 0x01, parseInt("00400", 8), 0);

  // this tells updateFromStream to read the entire file
  const PR_UINT32_MAX = 0xffffffff;
  ch.updateFromStream(istream, PR_UINT32_MAX);

  // pass false here to get binary data back
  var hash = ch.finish(false);
  // Close stream now, so we are ableo to kill the temporary file on cleanup
  istream.close();

  // convert the binary hash data to a hex string.
  var s = [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");

  if (s.toLowerCase() == aChecksum.toLowerCase()) return true;
  return false;
}
function toHexString(charCode) {
  return ("0" + charCode.toString(16)).slice(-2);
}

function parseurl(aURL) {
  // URL has to be a "prefbar://" URL
  if (!aURL.match(/^prefbar:\/\/(.+)$/)) {
    goPrefBar.msgAlert(null, goPrefBar.GetString("urlimport.properties", "msgurlinvalid"));
    return false;
  }
  aURL = RegExp.$1;

  // Split hash information, if available
  if (aURL.match(/^(.+)\/(md5|sha1|sha256):(\S+)$/)) {
    aURL = RegExp.$1;
    gHashType = RegExp.$2;
    gChecksum = RegExp.$3
  }

  var url = Components.classes['@mozilla.org/network/standard-url;1']
    .createInstance(Components.interfaces.nsIURL);
  url.spec = aURL;

  // URL security check
  const nsIScriptSecurityManager =
    Components.interfaces.nsIScriptSecurityManager;
  var secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
    .getService(nsIScriptSecurityManager);
  var principal = window.opener.content.document.nodePrincipal;
  var flags = nsIScriptSecurityManager.STANDARD;
  try {
    secMan.checkLoadURIWithPrincipal(principal, url, flags);
  } catch (e) {
    goPrefBar.msgAlert(null, goPrefBar.GetString("urlimport.properties", "msgurlinvalid"));
    return false;
  }

  // Permission check
  var pm = Components.classes["@mozilla.org/permissionmanager;1"]
    .getService(Components.interfaces.nsIPermissionManager);
  var perm = pm.testExactPermission(url, "extensions-prefbar-webimport");
  if (perm != Components.interfaces.nsIPermissionManager.ALLOW_ACTION) {
    goPrefBar.msgAlert(null, goPrefBar.GetString("urlimport.properties", "msgnopermission").replace(/\$HOST/, url.host));
    return false;
  }

  gURL = url;
  return true;
}

function PersistProgressListener() {}
PersistProgressListener.prototype = {
  QueryInterface : function(aIID) {
    if(aIID.equals(Components.interfaces.nsIWebProgressListener))
      return this;
    throw Components.results.NS_NOINTERFACE;
  },

  init : function() {},
  destroy : function() {},

  onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
      downloadDone(aStatus);
    }
  },

  onProgressChange : function (aWebProgress, aRequest,
                               aCurSelfProgress, aMaxSelfProgress,
                               aCurTotalProgress, aMaxTotalProgress) {
    var progress = document.getElementById("progress");
    if (aMaxTotalProgress == -1) {
      progress.mode = "undetermined";
    }
    else {
      progress.value = aCurTotalProgress / (aMaxTotalProgress / 100)
    }
  },
  onLocationChange : function(aWebProgress, aRequest, aLocation) {},
  onStatusChange : function(aWebProgress, aRequest, aStatus, aMessage) {},
  onSecurityChange : function(aWebProgress, aRequest, aState) {}
}
