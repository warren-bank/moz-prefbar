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
 * Portions created by the Initial Developer are Copyright (C) 2002-2012
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

const nsIProtocolHandler = Components.interfaces.nsIProtocolHandler;

var goPrefBar = Components.classes["@prefbar.mozdev.org/goprefbar;1"]
                          .getService().wrappedJSObject;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function PrefBarProtocol() {
}

PrefBarProtocol.prototype = {
  scheme: "prefbar",
  protocolFlags: nsIProtocolHandler.URI_NORELATIVE |
                 nsIProtocolHandler.URI_NOAUTH |
                 nsIProtocolHandler.URI_IS_LOCAL_RESOURCE |
                 nsIProtocolHandler.URI_DANGEROUS_TO_LOAD,

  newURI: function(aSpec, aOriginCharset, aBaseURI) {
    var uri = Components.classes["@mozilla.org/network/simple-uri;1"].createInstance(Components.interfaces.nsIURI);
    uri.spec = aSpec;
    return uri;
  },

  newChannel: function(aURI) {
    var string = "";
    if (aURI.spec.match(/^prefbar:\/\/(.+)\/([^\/]+)$/)) {
      var id = RegExp.$1;
      var pref = RegExp.$2;
      var button = goPrefBar.JSONUtils.mainDS["prefbar:button:" + id];
      if (button && button[pref])
        string = button[pref];
    }

    var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    string = converter.ConvertFromUnicode(string);

    var pipe = Components.classes["@mozilla.org/pipe;1"].createInstance(Components.interfaces.nsIPipe);
    pipe.init (false, false, string.length, 1, null);
    pipe.outputStream.write(string, string.length);
    pipe.outputStream.close();

    var inputStreamChannel = Components.classes["@mozilla.org/network/input-stream-channel;1"].createInstance(Components.interfaces.nsIInputStreamChannel);
    inputStreamChannel.setURI(aURI);
    inputStreamChannel.contentStream = pipe.inputStream;
    inputStreamChannel.QueryInterface(Components.interfaces.nsIChannel).contentCharset = "UTF-8";

    return inputStreamChannel;
  },
  classDescription: "PrefBar Protocol Handler",
  contractID: "@mozilla.org/network/protocol;1?name=prefbar",
  classID: Components.ID('{69ec8ad6-d3e6-4abc-a7f9-982bf6108392}'),
  QueryInterface: XPCOMUtils.generateQI([nsIProtocolHandler])
}

if (XPCOMUtils.generateNSGetFactory)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([PrefBarProtocol]);
else
  var NSGetModule = XPCOMUtils.generateNSGetModule([PrefBarProtocol]);
