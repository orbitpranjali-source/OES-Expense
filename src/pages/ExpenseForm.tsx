import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X } from 'lucide-react';
import { z } from 'zod';

const expenseSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters'),
  description: z.string().trim().optional(),
  amount: z.number().positive('Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  expense_date: z.string().min(1, 'Expense date is required'),
});

const EXPENSE_CATEGORIES = [
  'Travel',
  'Food & Dining',
  'Office Supplies',
  'Software & Tools',
  'Marketing',
  'Training',
  'Client Entertainment',
  'Equipment',
  'Other',
];

const ExpenseForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      fetchExpense();
    }
  }, [id]);

  const fetchExpense = async () => {
    if (!id) return;

    try {
      const { data: expense, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (expense.user_id !== user?.id) {
        toast({
          title: 'Access Denied',
          description: 'You can only edit your own expenses',
          variant: 'destructive',
        });
        navigate('/dashboard');
        return;
      }

      if (expense.status !== 'draft') {
        toast({
          title: 'Cannot Edit',
          description: 'You can only edit draft expenses',
          variant: 'destructive',
        });
        navigate('/dashboard');
        return;
      }

      setTitle(expense.title);
      setDescription(expense.description || '');
      setAmount(expense.amount.toString());
      setCategory(expense.category);
      setExpenseDate(expense.expense_date);

      // Fetch files
      const { data: filesData } = await supabase
        .from('expense_files')
        .select('*')
        .eq('expense_id', id)
        .eq('file_category', 'bill');

      setExistingFiles(filesData || []);
    } catch (error) {
      console.error('Error fetching expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to load expense',
        variant: 'destructive',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles([...files, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadFiles = async (expenseId: string) => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user?.id}/${expenseId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('expense-files')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('expense_files')
          .insert({
            expense_id: expenseId,
            file_name: file.name,
            file_path: fileName,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user?.id,
            file_category: 'bill',
          });

        if (dbError) throw dbError;
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, shouldSubmit: boolean = false) => {
    e.preventDefault();

    try {
      const validatedData = expenseSchema.parse({
        title: title.trim(),
        description: description.trim(),
        amount: parseFloat(amount),
        category,
        expense_date: expenseDate,
      });

      setLoading(true);

      let expenseId: string;

      if (id) {
        // Update existing
        const { error } = await supabase
          .from('expenses')
          .update({
            title: validatedData.title,
            description: validatedData.description || null,
            amount: validatedData.amount,
            category: validatedData.category,
            expense_date: validatedData.expense_date,
            status: (shouldSubmit ? 'submitted' : 'draft') as 'draft' | 'submitted',
          })
          .eq('id', id);

        if (error) throw error;
        expenseId = id;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('expenses')
          .insert([{
            title: validatedData.title,
            description: validatedData.description || null,
            amount: validatedData.amount,
            category: validatedData.category,
            expense_date: validatedData.expense_date,
            user_id: user?.id!,
            status: (shouldSubmit ? 'submitted' : 'draft') as 'draft' | 'submitted',
          }])
          .select()
          .single();

        if (error) throw error;
        expenseId = data.id;
      }

      // Upload files
      if (files.length > 0) {
        await uploadFiles(expenseId);
      }

      // Create status log
      await supabase.from('expense_status_logs').insert({
        expense_id: expenseId,
        status: shouldSubmit ? 'submitted' : 'draft',
        changed_by: user?.id,
        notes: shouldSubmit ? 'Expense submitted for review' : 'Expense saved as draft',
      });

      toast({
        title: 'Success',
        description: shouldSubmit 
          ? 'Expense submitted for approval' 
          : 'Expense saved as draft',
      });

      navigate('/dashboard');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      } else {
        console.error('Error saving expense:', error);
        toast({
          title: 'Error',
          description: 'Failed to save expense',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{id ? 'Edit Expense' : 'New Expense'}</CardTitle>
            <CardDescription>
              Fill in the details of your expense and upload the bill receipt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Team lunch at Restaurant"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Expense Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Add any additional details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Bill Receipt</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload bill receipts (PDF, JPG, PNG)
                  </p>
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    id="file-upload"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    Choose Files
                  </Button>
                </div>

                {existingFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Existing Files:</p>
                    {existingFiles.map((file) => (
                      <div key={file.id} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{file.file_name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">New Files:</p>
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between rounded-md border p-2">
                        <span className="text-sm">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => handleSubmit(e, false)}
                  disabled={loading || uploading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save as Draft'
                  )}
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || uploading}
                >
                  {loading || uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {uploading ? 'Uploading...' : 'Submitting...'}
                    </>
                  ) : (
                    'Submit for Approval'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ExpenseForm;
