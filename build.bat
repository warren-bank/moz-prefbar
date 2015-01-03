@echo off

rem :: http://sevenzip.sourceforge.jp/chm/cmdline/commands/add.htm

7z a -tzip -scsUTF-8 "prefbar.xpi" ".\chrome.manifest" ".\install.rdf" ".\LICENSE" "chrome\" "components\" "defaults\"
