import { supabase } from './supabaseClient.js';

export class CategoryService {
    static async getAll(localId) {
        if (!localId) return [];
        const { data, error } = await supabase
            .from('categorias')
            .select('*')
            .eq('local_id', localId)
            .order('orden', { ascending: true });
            
        if (error) throw error;
        return data || [];
    }

    static async create(nombre, localId) {
        if (!localId) throw new Error("Falta el identificador del local.");

        const { count, error: countError } = await supabase
            .from('categorias')
            .select('*', { count: 'exact', head: true })
            .eq('local_id', localId);
            
        if (countError) throw countError;
        
        const nuevoOrden = (count || 0) + 1;

        const { data, error } = await supabase
            .from('categorias')
            .insert([{ nombre, orden: nuevoOrden, local_id: localId }])
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    static async delete(id) {
        const { error } = await supabase
            .from('categorias')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        return true;
    }
}