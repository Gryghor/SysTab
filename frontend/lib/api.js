import axios from "axios"

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token")
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (
            typeof window !== "undefined" &&
            error?.response?.status === 403 &&
            error?.response?.data?.code === "PASSWORD_CHANGE_REQUIRED"
        ) {
            try {
                const usuario = JSON.parse(localStorage.getItem("usuario") || "{}")
                localStorage.setItem("usuario", JSON.stringify({
                    ...usuario,
                    trocaSenhaObrigatoria: true,
                }))
            } catch {
                localStorage.setItem("usuario", JSON.stringify({
                    trocaSenhaObrigatoria: true,
                }))
            }

            if (window.location.pathname !== "/primeiro-acesso") {
                window.location.href = "/primeiro-acesso"
            }
        }
        return Promise.reject(error)
    }
)

export default api
