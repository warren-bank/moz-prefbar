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

var hkeditor;

function hkeditSetupNew() {
  hkeditor = document.getElementById("HotkeyEditor");
}

function hkeditSetupEdit(itemId) {
  hkeditor = document.getElementById("HotkeyEditor");
  hkeditor.key = gMainDS[itemId].hkkey;
  hkeditor.keycode = gMainDS[itemId].hkkeycode;
  hkeditor.modifiers = gMainDS[itemId].hkmodifiers;
  hkeditor.update();
}

function hkeditSaveData(itemId) {
  if (hkeditor.key || hkeditor.keycode) {
    gMainDS[itemId].hkkey = hkeditor.key;
    gMainDS[itemId].hkkeycode = hkeditor.keycode;
    gMainDS[itemId].hkmodifiers = hkeditor.modifiers;
  }
  else {
    delete(gMainDS[itemId].hkkey);
    delete(gMainDS[itemId].hkkeycode);
    delete(gMainDS[itemId].hkmodifiers);
  }
}
