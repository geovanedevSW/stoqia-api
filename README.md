# Stoqia API 📦

> API REST para gerenciamento de estoque e transferências entre depósitos com tratamento de concorrência e transações ACID, construída com NestJS, TypeScript, PostgreSQL e Docker.

---

## 📋 Sobre o Projeto

O **Stoqia API** é um sistema de controle de estoque projetado para simular cenários críticos do mundo real. Diferente de um CRUD tradicional, o objetivo central do sistema é **garantir integridade absoluta dos dados**, prevenindo furos de estoque, saldos negativos e condições de corrida (*race conditions*) em requisições simultâneas.

### 🎯 Cenário Principal de Desafio
Imagine que existe apenas **uma unidade** de um determinado smartphone armazenada no **Depósito A**. Dois operadores ou sistemas externos solicitam, exatamente no mesmo milissegundo:
- **Operador 1:** Transferir 1 unidade do Depósito A para o Depósito B.
- **Operador 2:** Transferir 1 unidade do Depósito A para o Depósito C.

O **Stoqia API** utiliza **transações ACID** e **bloqueio pessimista no PostgreSQL (`SELECT ... FOR UPDATE`)**, garantindo que apenas uma operação seja efetivada e a outra receba um erro transparente de estoque insuficiente, preservando a consistência dos saldos.

---

## 🛠️ Stack Tecnológica

| Camada / Função | Tecnologia |
| :--- | :--- |
| **Linguagem** | TypeScript (Strict Mode) |
| **Runtime** | Node.js (v22+) |
| **Framework** | NestJS |
| **Banco de Dados** | PostgreSQL 16 |
| **ORM & Migrations** | TypeORM |
| **Validação de Entrada** | Class Validator & Class Transformer |
| **Containerização** | Docker & Docker Compose |
| **Testes Automatizados** | Jest & Supertest (Unitários e E2E) |
| **Versionamento** | Git, GitHub & Conventional Commits |

---

## 🏛️ Arquitetura de Software

A aplicação adota o padrão **modular idiomático do NestJS**, priorizando alta coesão, legibilidade, manutenibilidade e separação clara de responsabilidades:

```
src/
├── database/               # Conexão TypeORM (DataSource) e Migrations
│   ├── migrations/         # Migrations versionadas do banco de dados
│   └── data-source.ts      # Configuração centralizada do banco
├── modules/                # Módulos funcionais e independentes
│   ├── products/           # Módulo de Produtos
│   │   ├── dto/            # DTOs com validação (class-validator)
│   │   ├── entities/       # Entidade TypeORM mapeando a tabela 'products'
│   │   ├── products.controller.ts # Endpoints REST e validação de UUIDs
│   │   ├── products.service.ts    # Regras de negócio, unicidade e persistência
│   │   ├── products.service.spec.ts # Testes unitários do serviço
│   │   └── products.module.ts     # Encapsulamento do módulo
│   ├── warehouses/         # Módulo de Depósitos
│   ├── inventory/          # Saldos e regras de entrada, saída e ajuste
│   ├── movements/          # Histórico auditável de movimentações
│   └── transfers/          # Orquestração de transferências concorrentes
├── app.controller.ts       # Healthcheck inicial
├── app.module.ts           # Módulo raiz agregador
└── main.ts                 # Ponto de entrada e configuração do ValidationPipe
```

### Princípios Chave:
1. **Modularidade Coesa:** Cada módulo encapsula suas entidades, DTOs, controllers e services, expondo apenas o necessário via `exports`.
2. **Validação na Borda:** Nenhum dado inválido alcança o banco; o `ValidationPipe` global com `class-validator` barra dados inconsistentes antes de chegarem ao controller.
3. **Segurança de Identidade:** Todos os identificadores utilizam UUIDs v4 gerados nativamente pelo PostgreSQL (`gen_random_uuid()`) e validados na rota com `ParseUUIDPipe`.
4. **Imutabilidade e Soft Delete:** Produtos e movimentações utilizam inativação lógica (`is_active = false`), preservando a rastreabilidade e histórico contábil.
5. **Consistência Transacional:** Operações críticas de saldo operam sob transações com isolamento e controle de concorrência.

---

## 📡 Endpoints da API

### Módulo de Produtos (`/products`)

| Método | Rota | Descrição | Status de Sucesso |
| :--- | :--- | :--- | :--- |
| `POST` | `/products` | Cadastra um novo produto | `201 Created` |
| `GET` | `/products` | Lista todos os produtos cadastrados | `200 OK` |
| `GET` | `/products/:id` | Busca detalhes de um produto pelo UUID | `200 OK` |
| `PATCH` | `/products/:id` | Atualiza dados parciais do produto | `200 OK` |
| `DELETE` | `/products/:id` | Inativa um produto (*soft delete*) | `204 No Content` |

#### Exemplo de Payload para Criação (`POST /products`):
```json
{
  "name": "Smartphone Galaxy S24",
  "sku": "SM-GAL-S24",
  "description": "Aparelho 256GB Preto",
  "price": 4999.90
}
```

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) v22+
- [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/)
- [Git](https://git-scm.com/)

### 1. Clonar o repositório
```bash
git clone https://github.com/geovanedevSW/stoqia-api.git
cd stoqia-api
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo para criar o seu `.env`:
```bash
cp .env.example .env
```

### 3. Subir o Banco de Dados com Docker
Inicie o container do PostgreSQL em segundo plano:
```bash
docker compose up -d
```
Verifique se o container está saudável:
```bash
docker compose ps
```

### 4. Instalar as Dependências
```bash
npm install
```

### 5. Executar as Migrations
Aplique as migrações no banco de dados:
```bash
npm run migration:run
```

### 6. Iniciar a API em Desenvolvimento
```bash
npm run start:dev
```
A API estará acessível em: `http://localhost:3000`

---

## 🧪 Suíte de Testes

O projeto adota testes automatizados com Jest para garantir a confiabilidade das regras de negócio:

```bash
# Executar todos os testes unitários
npm test

# Executar testes em modo contínuo (watch)
npm run test:watch

# Verificar relatório de cobertura de código
npm run test:cov

# Executar testes End-to-End (E2E)
npm run test:e2e
```

---

## 🌿 Padrão de Git e Commits

- Todo novo desenvolvimento é realizado em branches específicas de feature (`feature/<nome>`).
- As branches passam por validação via Pull Request antes do merge na branch `main`.
- Os commits seguem a convenção do **Conventional Commits**:
  - `feat:` Nova funcionalidade
  - `fix:` Correção de bug
  - `chore:` Configurações, dependências e tarefas de manutenção
  - `refactor:` Alterações de código sem mudança de comportamento externo
  - `test:` Criação ou ajuste de testes automatizados

---

## 📄 Licença

Este projeto é de uso educacional e de desenvolvimento profissional.
