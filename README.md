# Stoqia API 📦

> API REST corporativa de alta confiabilidade para gerenciamento de estoque, depósitos e transferências concorrentes, construída com TypeScript, NestJS, PostgreSQL e Clean Architecture.

---

## 📋 Sobre o Projeto

O **Stoqia API** é um sistema de controle de estoque projetado para simular cenários críticos do mundo corporativo. Diferente de um CRUD tradicional, o objetivo central do sistema é **garantir integridade absoluta dos dados**, prevenindo furos de estoque, saldos negativos e condições de corrida (*race conditions*) em requisições simultâneas.

### Cenário Principal de Desafio
Imagine que existe apenas **uma unidade** de um determinado smartphone armazenada no **Depósito A**. Dois operadores ou sistemas externos solicitam, exatamente no mesmo milissegundo:
- Operador 1: Transferir 1 unidade do Depósito A para o Depósito B.
- Operador 2: Transferir 1 unidade do Depósito A para o Depósito C.

O **Stoqia API** utiliza **transações ACID** e **bloqueio pessimista no PostgreSQL (`SELECT ... FOR UPDATE`)**, garantindo que apenas uma operação seja efetivada e a outra receba um erro transparente de estoque insuficiente, preservando a consistência dos saldos.

---

## 🛠️ Stack Tecnológica

| Camada / Função | Tecnologia |
| :--- | :--- |
| **Linguagem** | TypeScript (Strict Mode) |
| **Runtime** | Node.js (v22+) |
| **Framework** | NestJS |
| **Banco de Dados** | PostgreSQL 16 |
| **ORM & Migrations** | TypeORM (Padrão Data Mapper) |
| **Validação de Entrada** | Class Validator & Class Transformer |
| **Containerização** | Docker & Docker Compose |
| **Testes Automatizados** | Jest & Supertest (Unitários, Integração e E2E) |
| **Versionamento** | Git, GitHub & Conventional Commits |

---

## 🏛️ Arquitetura de Software

A aplicação adota uma organização inspirada em **Clean Architecture** e princípios **SOLID**, adaptada para a ergonomia do NestJS:

```
src/
├── config/                 # Configurações globais e de ambiente
├── database/               # DataSource do TypeORM e Migrations
├── modules/                # Módulos funcionais e coesos
│   ├── products/           # Gestão de produtos e catálogo
│   │   ├── domain/         # Entidades de negócio puras e interfaces de repositório
│   │   ├── application/    # Casos de uso (Use Cases) e fluxos de negócio
│   │   ├── infrastructure/ # Modelos TypeORM, repositórios concretos e mappers
│   │   └── presentation/   # Controllers REST e DTOs de entrada/saída
│   ├── warehouses/         # Gestão de depósitos e locais de armazenagem
│   ├── inventory/          # Saldos e regras de entrada, saída e ajuste
│   ├── movements/          # Histórico auditável de movimentações
│   └── transfers/          # Orquestração de transferências concorrentes
└── shared/                 # Filtros de exceção, interceptors, decorators e utilitários
```

### Princípios Chave:
1. **Regra da Dependência:** O domínio do negócio (`domain/`) não depende de nenhum framework, ORM ou protocolo HTTP.
2. **Inversão de Dependência (DIP):** Casos de uso interagem com interfaces abstratas de repositório; os repositórios do TypeORM implementam essas interfaces na camada de infraestrutura.
3. **Imutabilidade e Auditoria:** Movimentações de estoque não são alteradas ou apagadas fisicamente, assegurando rastreabilidade total.

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
Verifique se o banco está saudável com:
```bash
docker compose ps
```

### 4. Instalar as Dependências
```bash
npm install
```

### 5. Executar as Migrations
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

O projeto adota a pirâmide de testes para garantir máxima confiabilidade:

```bash
# Executar todos os testes unitários
npm test

# Executar testes unitários em modo watch (desenvolvimento contínuo)
npm run test:watch

# Executar testes End-to-End (E2E)
npm run test:e2e

# Verificar cobertura de código
npm run test:cov
```

---

## 🌿 Padrão de Git e Commits

- Todo novo desenvolvimento é feito em branches específicas de feature (`feature/<nome>`).
- As branches passam por validação e Pull Request antes do merge na branch `main`.
- Os commits seguem a convenção do **Conventional Commits**:
  - `feat:` Nova funcionalidade
  - `fix:` Correção de bug
  - `chore:` Configurações, dependências e tarefas de manutenção
  - `refactor:` Alterações de código que não mudam regras externas
  - `test:` Criação ou ajuste de testes automatizados

---

## 📄 Licença

Este projeto é de uso educacional e de desenvolvimento profissional.
