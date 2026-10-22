import { supabase } from './supabaseClient.js';

export class AuthService {
    /**
     * Inicia sesión con correo y contraseña.
     */
    static async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        return data;
    }

    /**
     * Cierra la sesión activa.
     */
    static async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(error.message);
    }

    /**
     * Obtiene la sesión actual del usuario.
     */
    static async getSession() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw new Error(error.message);
        return session;
    }

    /**
     * Consulta el rol asignado al correo electrónico en la tabla 'admins'.
     * Retorna 'admin', 'empleado' o null si no está autorizado.
     */
    static async getUserRole(email) {
        const { data, error } = await supabase
            .from('admins')
            .select('rol')
            .eq('email', email)
            .single();

        if (error || !data) return null;
        return data.rol;
    }

    /**
     * Redirige al usuario según su rol en el sistema.
     */
    static async redirectByRole(email) {
        const role = await this.getUserRole(email);
        if (role === 'admin') {
            window.location.href = 'admin.html';
        } else if (role === 'empleado') {
            window.location.href = 'empleados.html';
        } else {
            alert('Tu usuario no está autorizado para acceder.');
            await this.logout();
            window.location.reload();
        }
    }

    /**
     * Envía un correo para restablecer la contraseña.
     */
    static async sendResetEmail(email) {
        const redirectUrl = window.location.href.replace('login.html', 'reset-password.html');
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
        if (error) throw new Error(error.message);
    }

    /**
     * Actualiza la contraseña del usuario autenticado.
     */
    static async updatePassword(newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message);
    }
}