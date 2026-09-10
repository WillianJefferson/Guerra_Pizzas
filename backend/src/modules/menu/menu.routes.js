import express from "express"
import { 
    listarPizzas,
    buscarPizzaPorId,
    criarPizza,
    atualizarPizza,
    deletarPizza
} from "./menu.controller.js"

const router = express.Router()

router.get("/pizzas", listarPizzas)
router.get("/pizzas/:id", buscarPizzaPorId)
router.post("/pizzas", criarPizza)
router.put("/pizzas/:id", atualizarPizza)
router.delete("/pizzas/:id", deletarPizza)

export default router