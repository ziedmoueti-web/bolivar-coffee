#!/usr/bin/env node
/* ============================================================
   BOLIVAR COFFEE — Simple JSON Database
   File-based database with SQLite-like query support.
   Zero native dependencies. Works everywhere.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'bolivar.json');

class Database {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch (e) {
      this.data = {};
    }
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  // Get all rows from a table
  all(table, filterFn) {
    const rows = this.data[table] || [];
    if (filterFn) return rows.filter(filterFn);
    return rows.slice();
  }

  // Get first matching row
  get(table, filterFn) {
    const rows = this.data[table] || [];
    return rows.find(filterFn) || null;
  }

  // Get row by ID
  getById(table, id) {
    return this.get(table, r => r.id === id);
  }

  // Count rows
  count(table, filterFn) {
    return this.all(table, filterFn).length;
  }

  // Sum a column
  sum(table, column, filterFn) {
    return this.all(table, filterFn).reduce((acc, r) => acc + (r[column] || 0), 0);
  }

  // Insert a row
  insert(table, record) {
    if (!this.data[table]) this.data[table] = [];
    record.id = record.id || this.nextId(table);
    record.created_at = record.created_at || new Date().toISOString();
    this.data[table].push(record);
    this.save();
    return record;
  }

  // Update rows matching filter
  update(table, updates, filterFn) {
    const rows = this.data[table] || [];
    let count = 0;
    rows.forEach(row => {
      if (filterFn(row)) {
        Object.assign(row, updates, { updated_at: new Date().toISOString() });
        count++;
      }
    });
    this.save();
    return count;
  }

  // Update by ID
  updateById(table, id, updates) {
    return this.update(table, updates, r => r.id === id);
  }

  // Delete rows matching filter
  delete(table, filterFn) {
    if (!this.data[table]) return 0;
    const before = this.data[table].length;
    this.data[table] = this.data[table].filter(r => !filterFn(r));
    this.save();
    return before - this.data[table].length;
  }

  // Delete by ID
  deleteById(table, id) {
    return this.delete(table, r => r.id === id);
  }

  // Upsert by a key field
  upsert(table, record, keyField) {
    if (!this.data[table]) this.data[table] = [];
    const idx = this.data[table].findIndex(r => r[keyField] === record[keyField]);
    if (idx >= 0) {
      Object.assign(this.data[table][idx], record);
    } else {
      record.id = record.id || this.nextId(table);
      this.data[table].push(record);
    }
    this.save();
    return record;
  }

  // Sort by field
  sorted(table, field, ascending) {
    const rows = this.all(table);
    rows.sort((a, b) => {
      if (a[field] < b[field]) return ascending ? -1 : 1;
      if (a[field] > b[field]) return ascending ? 1 : -1;
      return 0;
    });
    return rows;
  }

  // Next auto-increment ID
  nextId(table) {
    const rows = this.data[table] || [];
    if (rows.length === 0) return 1;
    return Math.max(...rows.map(r => r.id || 0)) + 1;
  }

  // Next order number
  nextOrderNumber() {
    const rows = this.data['orders'] || [];
    if (rows.length === 0) return 1001;
    return Math.max(...rows.map(r => r.order_number || 0)) + 1;
  }
}

const db = new Database(DB_PATH);

module.exports = db;
