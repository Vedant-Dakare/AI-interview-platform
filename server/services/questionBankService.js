import prisma from '../prisma/client.js'

const ROLE_QUESTION_BANK = {
  backend: [
    {
      questionText: 'What is async and await in JavaScript, and why is it used?',
      idealAnswer:
        'Async and await simplify working with promises. async makes a function return a promise, and await pauses execution until the promise resolves, which improves readability and error handling with try/catch.',
    },
    {
      questionText: 'Explain how REST APIs are designed and what makes an endpoint RESTful.',
      idealAnswer:
        'A RESTful API uses resource-based URLs, standard HTTP methods, stateless requests, proper status codes, and often JSON representations. Each endpoint should represent resources and support predictable operations like GET, POST, PUT, and DELETE.',
    },
    {
      questionText: 'What is database indexing, and when can an index hurt performance?',
      idealAnswer:
        'Indexes speed up reads by creating searchable structures on columns, but they increase storage and slow inserts, updates, and deletes because index entries must also be maintained.',
    },
    {
      questionText: 'How does the Node.js event loop handle concurrency?',
      idealAnswer:
        'Node.js uses a single-threaded event loop with non-blocking I/O. Work is delegated to system APIs or thread pools, and callbacks or promise microtasks are processed when operations complete.',
    },
    {
      questionText: 'What is the difference between authentication and authorization?',
      idealAnswer:
        'Authentication verifies identity, such as login with credentials or tokens. Authorization decides what an authenticated user is allowed to access or do.',
    },
    {
      questionText: 'Describe middleware in Express and a practical use case.',
      idealAnswer:
        'Middleware are functions that run in the request-response cycle and can read, modify, or block requests. Common uses include logging, authentication checks, validation, and centralized error handling.',
    },
    {
      questionText: 'Why do we use transactions in databases?',
      idealAnswer:
        'Transactions group related operations into one atomic unit, ensuring either all operations commit or all roll back, which maintains consistency for multi-step writes.',
    },
    {
      questionText: 'What are common strategies to secure backend APIs?',
      idealAnswer:
        'Use HTTPS, strong authentication, role-based authorization, rate limiting, input validation, output escaping, secure headers, secret management, and auditing/logging for suspicious actions.',
    },
    {
      questionText: 'How would you design pagination for a large dataset API?',
      idealAnswer:
        'Use limit and cursor or offset parameters with stable sorting, include metadata like next cursor, and avoid large offsets on huge datasets by preferring cursor-based pagination for performance.',
    },
    {
      questionText: 'What is caching and where would you apply it in backend systems?',
      idealAnswer:
        'Caching stores frequently requested data in fast storage like memory or Redis to reduce latency and database load. It is useful for read-heavy endpoints, computed aggregates, and session/token lookups.',
    },
  ],
  dsa: [
    {
      questionText: 'What is time complexity and why is Big-O notation useful?',
      idealAnswer:
        'Time complexity describes how running time grows with input size. Big-O focuses on asymptotic upper bounds, helping compare algorithm scalability independently of hardware.',
    },
    {
      questionText: 'Explain binary search and its prerequisites.',
      idealAnswer:
        'Binary search repeatedly halves the search range and runs in O(log n), but it requires sorted data and random access to middle elements.',
    },
    {
      questionText: 'What is the difference between arrays and linked lists?',
      idealAnswer:
        'Arrays provide contiguous storage and O(1) indexed access but expensive middle insertions. Linked lists allow efficient node insertions/deletions with pointer updates but have O(n) access by index.',
    },
    {
      questionText: 'How does a hash table work and what causes collisions?',
      idealAnswer:
        'A hash table maps keys to indices using a hash function. Collisions happen when different keys map to the same index, resolved by chaining or open addressing.',
    },
    {
      questionText: 'When would you use a stack versus a queue?',
      idealAnswer:
        'Use a stack for LIFO behavior like recursion, expression parsing, and undo operations. Use a queue for FIFO behavior like scheduling, breadth-first search, and buffering.',
    },
    {
      questionText: 'Describe depth-first search and breadth-first search on graphs.',
      idealAnswer:
        'DFS explores one branch deeply before backtracking, often using recursion or a stack. BFS explores level by level using a queue and is useful for shortest paths in unweighted graphs.',
    },
    {
      questionText: 'What is dynamic programming and how do you identify DP problems?',
      idealAnswer:
        'Dynamic programming solves overlapping subproblems with optimal substructure by storing intermediate results in memoization or tabulation to avoid repeated computation.',
    },
    {
      questionText: 'Explain recursion and the importance of a base case.',
      idealAnswer:
        'Recursion is when a function calls itself on smaller inputs. A correct base case stops recursion and prevents infinite calls and stack overflow.',
    },
    {
      questionText: 'What is the difference between greedy and dynamic programming approaches?',
      idealAnswer:
        'Greedy makes locally optimal decisions step by step and is efficient when greedy-choice property holds. Dynamic programming considers combinations of states to guarantee global optimum when greedy is insufficient.',
    },
    {
      questionText: 'How do balanced binary search trees improve operations?',
      idealAnswer:
        'Balanced BSTs maintain near-logarithmic height, so search, insert, and delete are typically O(log n), unlike skewed trees that can degrade to O(n).',
    },
  ],
  ml: [
    {
      questionText: 'What is overfitting and how can you reduce it?',
      idealAnswer:
        'Overfitting is when a model learns noise and performs poorly on unseen data. Reduce it using regularization, cross-validation, simpler models, early stopping, dropout, and more training data.',
    },
    {
      questionText: 'Explain gradient descent in machine learning.',
      idealAnswer:
        'Gradient descent iteratively updates model parameters in the negative direction of the loss gradient to minimize error. Learning rate controls step size and convergence behavior.',
    },
    {
      questionText: 'What is the difference between supervised and unsupervised learning?',
      idealAnswer:
        'Supervised learning uses labeled data to learn mappings from inputs to targets. Unsupervised learning discovers structure or patterns in unlabeled data, such as clustering or dimensionality reduction.',
    },
    {
      questionText: 'Why is train, validation, and test split important?',
      idealAnswer:
        'The train set fits the model, validation tunes hyperparameters, and test evaluates final generalization. Separating them prevents optimistic bias and data leakage.',
    },
    {
      questionText: 'What are precision and recall, and when do they matter?',
      idealAnswer:
        'Precision measures correctness of positive predictions, while recall measures how many actual positives are found. High recall is critical when missing positives is costly, high precision when false alarms are costly.',
    },
    {
      questionText: 'What is regularization and why is it used?',
      idealAnswer:
        'Regularization adds penalties like L1 or L2 to reduce model complexity, improve generalization, and prevent overfitting by discouraging overly large weights.',
    },
    {
      questionText: 'How does feature scaling help ML algorithms?',
      idealAnswer:
        'Feature scaling puts features on similar ranges, which speeds optimization and prevents high-magnitude features from dominating distance-based or gradient-based methods.',
    },
    {
      questionText: 'What is cross-validation and what problem does it solve?',
      idealAnswer:
        'Cross-validation evaluates performance across multiple data splits to provide more stable estimates and better hyperparameter selection than a single split.',
    },
    {
      questionText: 'Explain bias-variance tradeoff.',
      idealAnswer:
        'High bias causes underfitting and high variance causes overfitting. The goal is to balance both to minimize total generalization error.',
    },
    {
      questionText: 'What is a confusion matrix and how is it used?',
      idealAnswer:
        'A confusion matrix summarizes true positives, true negatives, false positives, and false negatives, enabling calculation of metrics like accuracy, precision, recall, and F1 score.',
    },
  ],
}

function normalizeRole(role) {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()

  if (!normalized) {
    return null
  }

  if (normalized.includes('backend')) {
    return 'backend'
  }

  if (normalized === 'dsa' || normalized.includes('data structure') || normalized.includes('algorithm')) {
    return 'dsa'
  }

  if (normalized === 'ml' || normalized.includes('machine learning')) {
    return 'ml'
  }

  return null
}

let roleBankSeeded = false

async function ensureRoleQuestionBank() {
  if (roleBankSeeded) {
    return
  }

  const roles = Object.keys(ROLE_QUESTION_BANK)

  for (const role of roles) {
    const roleQuestions = ROLE_QUESTION_BANK[role]

    for (let index = 0; index < roleQuestions.length; index += 1) {
      const question = roleQuestions[index]
      const orderIndex = index + 1

      await prisma.roleQuestion.upsert({
        where: {
          role_orderIndex: {
            role,
            orderIndex,
          },
        },
        update: {
          questionText: question.questionText,
          idealAnswer: question.idealAnswer,
        },
        create: {
          role,
          questionText: question.questionText,
          idealAnswer: question.idealAnswer,
          orderIndex,
        },
      })
    }
  }

  roleBankSeeded = true
}

async function getRoleQuestionsOrFail(roleInput) {
  const role = normalizeRole(roleInput)

  if (!role) {
    const error = new Error('role must be one of: backend, dsa, ml')
    error.statusCode = 400
    throw error
  }

  await ensureRoleQuestionBank()

  const questions = await prisma.roleQuestion.findMany({
    where: { role },
    orderBy: { orderIndex: 'asc' },
  })

  if (questions.length !== 10) {
    const error = new Error(`Expected 10 predefined questions for role ${role}`)
    error.statusCode = 500
    throw error
  }

  return { role, questions }
}

export { ROLE_QUESTION_BANK, normalizeRole, getRoleQuestionsOrFail }
