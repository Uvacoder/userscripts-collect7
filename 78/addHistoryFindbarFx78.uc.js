// ==UserScript==
// @name           addHistoryFindbarFx78.uc.js
// @namespace      http://space.geocities.yahoo.co.jp/gl/alice0775
// @description    add History to Findbar
// @include        main
// @compatibility  Firefox 78
// @author         Alice0775
// @version        2020/12/16 00:00 新しい順
// @version        2020/12/15 17:00 simplify
// ==/UserScript==
const addHistoryFindbar78 = {
  typingSpeed: 1000,
  
  init: function() {

    var style = `
      `.replace(/\s+/g, " ");

    var sspi = document.createProcessingInstruction(
      'xml-stylesheet',
      'type="text/css" href="data:text/css,' + encodeURIComponent(style) + '"'
    );
    document.insertBefore(sspi, document.documentElement);
    sspi.getAttribute = function(name) {
      return document.documentElement.getAttribute(name);
    };

    this.ellipsis = "\u2026";
    try {
      this.ellipsis = Services.prefs.getComplexValue(
        "intl.ellipsis",
        Ci.nsIPrefLocalizedString
      ).data;
    } catch (e) {}

    addHistoryFindbar_storage.initDB();

    gBrowser.tabContainer.addEventListener('TabFindInitialized', this, false);
    gBrowser.tabContainer.addEventListener('TabClose', this, false);
    
    window.addEventListener("find", this, false);
    window.addEventListener("findagain", this, false);
  },

  initFindBar: function() {
    if (/pending/.test(gBrowser.getFindBar.toString()) &&
        typeof gFindBar == "undefined") {
      setTimeout(() => {
        gBrowser.getFindBar().then(findbar => {
          this.addDropMarker(findbar);
        });
      }, 1000); /// xxx workarroundfor Bug 1411707
      return;
    } else {
      gFindBar = gBrowser.getFindBar();
      this.addDropMarker(gFindBar);
     
    }
  },

  addDropMarker: function(findbar) {
    this.kNSXUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    let ref = findbar.getElement("highlight");

    let menu = document.createElementNS(this.kNSXUL, "toolbarbutton");
    ref.parentNode.insertBefore(menu, ref);
    menu.setAttribute("anonid", "historydropmarker");
    menu.setAttribute("type", "menu");
    menu.setAttribute("class", "findBar-history-dropmarker findbar-button tabbable");
    menu.setAttribute("tooltiptext", "Show history");
    menu.setAttribute("label", "▽");
    //menu.setAttribute("accesskey", "h");
    menu.setAttribute("tooltiptext", "Find term History");
    let menupopup = document.createElementNS(this.kNSXUL, "menupopup");
    menupopup.setAttribute("onpopupshowing", "addHistoryFindbar78.onpopupshowing(event);");
    menupopup.setAttribute("anonid", "historypopup");
    menupopup.setAttribute("oncommand", "addHistoryFindbar78.copyToFindfield(event);");
    menu.appendChild(menupopup);

    gFindBar._findField.FormHistory =
      (ChromeUtils.import("resource://gre/modules/FormHistory.jsm", {})).FormHistory;
    gFindBar._findField.lastInputValue = "";

    gFindBar._findField.addEventListener("focus", this, false);
    gFindBar._findField.addEventListener("input", this, false);
  },

  uninit: function() {
    addHistoryFindbar_storage.closeDB();
    gBrowser.tabContainer.removeEventListener('TabFindInitialized', this, false);
    gBrowser.tabContainer.removeEventListener('TabClose', this, false);
    window.removeEventListener("find", this, false);
    window.removeEventListener("findagain", this, false);

  },

  handleEvent: function(event){
    //Services.console.logStringMessage(event.type);
    switch (event.type) {
      case 'unload':
        this.uninit();
        break;
      case 'TabFindInitialized':
        this.initFindBar();
        break;
      case 'TabClose':
        break;
      case 'find':
      case 'findagain':
        let text = event.detail.query;
        if (gFindBar._findField.lastInputValue != text &&
            text.length > 1) {
          this.addToHistory(text);
          gFindBar._findField.lastInputValue = event.detail.query;
        }
    }
  },

  copyToFindfield: function(aEvent){
    var target = aEvent.originalTarget;
    //本来のfindbar-textboxに転記して, ダミーイベント送信
    gFindBar._findField.value  = target.getAttribute("data");
    
    gFindBar._findField.removeAttribute('status');
    var evt = document.createEvent("UIEvents");
    evt.initUIEvent("input", true, false, window, 0);
    gFindBar._findField.dispatchEvent(evt);
    return;
  },

  timer: null,
  addToHistory: function(value){
    if (!value)
      return;

    if (this.timer) {
        clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      let fieldname = "findbar-history";
      let count = addHistoryFindbar_storage.getCount("findbar-history", value);
      if (!count) {
        addHistoryFindbar_storage.insert(fieldname, value, 1) ;
      } else {
        addHistoryFindbar_storage.updateCount(fieldname, value, ++count);
      }
    }, this.typingSpeed);
  },
  
  clearHistory: function() {
    gFindBar._findField.lastInputValue = "";
    addHistoryFindbar_storage.deleteAll("findbar-history");
  },

  getHistory: function() {
    return addHistoryFindbar_storage.getValues("findbar-history", "id", true);
  },

  onpopupshowing: function(event) {
    let results = this.getHistory();
    let popup = event.target;
    while(popup.lastChild) {
      popup.removeChild(popup.lastChild);
    }

    let max = 20;
    for (let entry of results) {
      let text = entry.value;
      let element = document.createElementNS(this.kNSXUL, "menuitem");
      element.setAttribute("data", text);

      if (text.length > 15) {
        let truncLength = 15;
        let truncChar = text[15].charCodeAt(0);
        if (truncChar >= 0xdc00 && truncChar <= 0xdfff) {
          truncLength++;
        }
        text = text.substr(0, truncLength) + this.ellipsis;
      }
      element.setAttribute("label", text);
      popup.appendChild(element);

      if (max-- < 0)
        break;
    }
    let element = document.createElementNS(this.kNSXUL, "menuseparator");
    popup.appendChild(element);

    element = document.createElementNS(this.kNSXUL, "menuitem");
    label = "Clear Search History";
    akey = "H";
    element.setAttribute("label", label);
    element.setAttribute("accesskey", akey);
    element.setAttribute("oncommand", "event.stopPropagation(); addHistoryFindbar78.clearHistory();");

    popup.appendChild(element);
  }
}


var addHistoryFindbar_storage = {
  db: null,
  initDB: function() {
    let file = FileUtils.getFile("UChrm", ["HistoryFindbar.sqlite"]);
    if (!file.exists()) {
      this.db = Services.storage.openDatabase(file);
      let stmt = this.db.createStatement(
        "CREATE TABLE HistoryFindbar (id INTEGER PRIMARY KEY AUTOINCREMENT, fieldname TEXT NOT NULL, value TEXT NOT NULL, count INTEGER)"
      );
      try {
        stmt.execute();
      } finally {
        stmt.finalize();
      }
    } else {
      this.db = Services.storage.openDatabase(file);
    }
  },

  closeDB: function() {
    try {
      this.db.close();
    } catch(e) {}
  },

  getValues: function(fieldname, order = "", desc = false) {
    let orderBy = "";
    if (order == "id") {
      orderBy = "ORDER BY id";
    } else if (order == "value"){
      orderBy = "ORDER BY value";
    } else if (order == "count"){
      orderBy = "ORDER BY count";
    }
    if (desc)
      orderBy += " DESC"
    
    let results = [];
    let sql = "SELECT value, count FROM HistoryFindbar WHERE fieldname = :fieldname " + orderBy;
    
    let stmt = this.db.createStatement(sql);
    stmt.params['fieldname'] = fieldname;
    try {
      while (stmt.executeStep()) {
        value = stmt.row.value;
        count = stmt.row.count;
        results.push({fieldname: fieldname, value: value, count: count});
      }
    } finally {
      stmt.finalize();
    }
    return results;
  },

  getCount: function(fieldname, value) {
    if (typeof fieldname != "string" || !fieldname)
      return;
    if (typeof value != "string" || !value)
      return;

    let count = 0;
    let stmt = this.db.createStatement(
      "SELECT count FROM HistoryFindbar WHERE fieldname = :fieldname AND value = :value"
    );
    stmt.params['fieldname'] = fieldname;
    stmt.params['value'] = value;
    try {
      while (stmt.executeStep()) {
        count = stmt.row.count;
        break;
      }
    } finally {
      stmt.finalize();
    }
    return count;
  },

  insert: function(fieldname, value, count) {
    if (typeof fieldname != "string" || !fieldname)
      return;
    if (typeof value != "string" || !value)
      return;
    if (typeof count != "number")
      return;

    let stmt = this.db.createStatement(
      "INSERT INTO HistoryFindbar (fieldname, value, count) VALUES (:fieldname, :value, :count)"
    );
    stmt.params['fieldname'] = fieldname;
    stmt.params['value'] = value;
    stmt.params['count'] = count;
    try {
      stmt.execute();
    } catch(ex) {
    } finally {
      stmt.finalize();
    }

  },

  updateCount: function(fieldname, value, count) {
    if (typeof fieldname != "string" || !fieldname)
      return;
    if (typeof value != "string" || !value)
      return;

    let stmt = this.db.createStatement(
      "UPDATE HistoryFindbar SET count = :count WHERE fieldname = :fieldname AND value = :value"
    );
    stmt.params['fieldname'] = fieldname;
    stmt.params['value'] = value;
    stmt.params['count'] = count;
    try {
      stmt.execute();
    } finally {
      stmt.finalize();
    }
  },

  deleteAll: function(fieldname) {
    if (typeof fieldname != "string" || !fieldname)
      return;

    let stmt = this.db.createStatement(
      "DELETE FROM HistoryFindbar WHERE fieldname = :fieldname"
    );
    stmt.params['fieldname'] = fieldname;
    try {
      stmt.execute();
    } finally {
      stmt.finalize();
    }
  },

  deleteAllData: function() {
    let stmt = this.db.createStatement(
      "DELETE FROM HistoryFindbar"
    );
    try {
      stmt.execute();
    } finally {
      stmt.finalize();
    }
  }
}


addHistoryFindbar78.init();
