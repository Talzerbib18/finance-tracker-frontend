import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Transaction } from '../models/transaction.model';
import { Category } from '../models/category.model';

export interface ImportRow {
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  categoryName?: string;
  notes?: string;
  status?: 'ok' | 'error';
  error?: string;
}

export interface ImportResult {
  success: number;
  errors: number;
  rows: ImportRow[];
}

@Injectable({ providedIn: 'root' })
export class ExcelService {

  // ---- Colonnes attendues dans le fichier Excel ----
  private readonly EXPECTED_HEADERS = ['Date', 'Description', 'Type', 'Montant', 'Catégorie', 'Notes'];

  // ---- EXPORT ----

  exportTransactions(transactions: Transaction[], filename = 'transactions'): void {
    const rows = transactions.map(t => ({
      Date:        t.date ? t.date.split('T')[0] : '',
      Description: t.description,
      Type:        t.type === 'INCOME' ? 'Revenu' : 'Dépense',
      Montant:     t.amount,
      Catégorie:   t.categoryName || '',
      Notes:       t.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows, { header: this.EXPECTED_HEADERS });

    // Largeurs des colonnes
    ws['!cols'] = [
      { wch: 14 }, // Date
      { wch: 36 }, // Description
      { wch: 12 }, // Type
      { wch: 14 }, // Montant
      { wch: 20 }, // Catégorie
      { wch: 30 }, // Notes
    ];

    // Style header (SheetJS community ne supporte pas le style — on le laisse simple)
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // ---- GÉNÉRATION D'UN TEMPLATE VIDE ----

  generateTemplate(): void {
    const rows = [
      { Date: '2026-06-01', Description: 'Exemple revenu', Type: 'Revenu',  Montant: 2500,  Catégorie: 'Salaire',      Notes: '' },
      { Date: '2026-06-02', Description: 'Exemple dépense', Type: 'Dépense', Montant: 45.50, Catégorie: 'Alimentation', Notes: 'Courses' },
    ];

    const ws = XLSX.utils.json_to_sheet(rows, { header: this.EXPECTED_HEADERS });
    ws['!cols'] = [
      { wch: 14 },
      { wch: 36 },
      { wch: 12 },
      { wch: 14 },
      { wch: 20 },
      { wch: 30 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, 'template_transactions.xlsx');
  }

  // ---- IMPORT ----

  parseFile(file: File): Promise<ImportRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb   = XLSX.read(data, { type: 'array', cellDates: true });
          const ws   = wb.Sheets[wb.SheetNames[0]];
          const raw  = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });

          const rows: ImportRow[] = raw.map((r: any, i: number) => {
            try {
              const description = String(r['Description'] || r['description'] || '').trim();
              const notes       = String(r['Notes'] || r['notes'] || '').trim();
              const categoryName = String(r['Catégorie'] || r['categorie'] || r['Categorie'] || '').trim();

              // Montant
              const rawAmount = r['Montant'] || r['montant'] || 0;
              const amount    = parseFloat(String(rawAmount).replace(',', '.'));

              // Date
              let date = '';
              const rawDate = r['Date'] || r['date'];
              if (rawDate instanceof Date) {
                date = rawDate.toISOString().split('T')[0];
              } else if (rawDate) {
                // Essayer plusieurs formats
                const d = new Date(String(rawDate).replace(/\//g, '-'));
                date = isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
              }

              // Type
              const rawType = String(r['Type'] || r['type'] || 'Dépense').toLowerCase();
              const type: 'INCOME' | 'EXPENSE' =
                rawType.includes('rev') || rawType === 'income' ? 'INCOME' : 'EXPENSE';

              // Validation
              if (!description) throw new Error('Description manquante');
              if (isNaN(amount) || amount <= 0) throw new Error('Montant invalide');
              if (!date) throw new Error('Date invalide');

              return { description, amount, type, date, categoryName: categoryName || undefined, notes: notes || undefined, status: 'ok' };
            } catch (err: any) {
              return { description: '', amount: 0, type: 'EXPENSE', date: '', status: 'error', error: `Ligne ${i + 2} : ${err.message}` };
            }
          });

          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Associe le nom de catégorie à son id
  resolveCategories(rows: ImportRow[], categories: Category[]): void {
    rows.forEach(row => {
      if (row.categoryName) {
        const cat = categories.find(c =>
          c.name.toLowerCase() === row.categoryName!.toLowerCase()
        );
        (row as any).categoryId = cat?.id;
      }
    });
  }
}
