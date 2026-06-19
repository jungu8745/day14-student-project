const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(function (request, response, next) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());

app.use(function (error, request, response, next) {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    response.status(400).json({
      message: "JSON 형식이 올바르지 않습니다.",
    });
    return;
  }

  next(error);
});

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function isIntegerId(value) {
  const id = Number(value);
  return Number.isInteger(id) ? id : null;
}

function readStudentBody(body) {
  const source = body || {};
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const score = source.score;

  if (
    name.length < 1 ||
    name.length > 50 ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > 100
  ) {
    return null;
  }

  return {
    name: name,
    score: score,
  };
}

async function findStudentById(id) {
  const [rows] = await pool.query(
    "SELECT id, name, score FROM students WHERE id = ?",
    [id]
  );

  return rows[0];
}

function sendTodo(response, apiName) {
  response.status(501).json({
    message: `${apiName} API를 구현해야 합니다.`,
  });
}

app.get("/health", function (request, response) {
  response.json({
    status: "ok",
  });
});

app.get("/students/search", async function (request, response, next) {
  try {
    const minScore = Number(request.query.minScore);
    const maxScore = Number(request.query.maxScore);

    if (!Number.isInteger(minScore) || !Number.isInteger(maxScore)) {
      response.status(400).json({
        message: "점수 범위가 올바르지 않습니다.",
      });
      return;
    }

    if (minScore > maxScore) {
      response.status(400).json({
        message: "최소 점수는 최대 점수보다 클 수 없습니다.",
      });
      return;
    }

    const [rows] = await pool.query(
      "SELECT id, name, score FROM students WHERE score BETWEEN ? AND ? ORDER BY id ASC",
      [minScore, maxScore]
    );

    response.json(rows);
  } catch (error) {
    next(error);
  }
});

console.log("GET STUDENTS ROUTE LOADED");

app.get("/students", async function (request, response, next) {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, score FROM students ORDER BY id ASC"
    );

    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/students", async function (request, response, next) {
  try {
    const studentData = readStudentBody(request.body);

    if (!studentData) {
      response.status(400).json({
        message: "입력값이 올바르지 않습니다.",
      });
      return;
    }

    const [result] = await pool.query(
      "INSERT INTO students (name, score) VALUES (?, ?)",
      [studentData.name, studentData.score]
    );

    const newStudent = await findStudentById(result.insertId);

    response.status(201).json(newStudent);
  } catch (error) {
    next(error);
  }
});

app.get("/students/:id", async function (request, response, next) {
  try {
    const id = isIntegerId(request.params.id);

    if (id === null) {
      response.status(400).json({
        message: "올바른 학생 ID가 아닙니다.",
      });
      return;
    }

    const student = await findStudentById(id);

    if (!student) {
      response.status(404).json({
        message: "학생을 찾을 수 없습니다.",
      });
      return;
    }

    response.json(student);
  } catch (error) {
    next(error);
  }
});

app.patch("/students/:id", async function (request, response, next) {
  try {
    const id = isIntegerId(request.params.id);

    if (id === null) {
      response.status(400).json({
        message: "올바른 학생 ID가 아닙니다.",
      });
      return;
    }

    const student = await findStudentById(id);

    if (!student) {
      response.status(404).json({
        message: "학생을 찾을 수 없습니다.",
      });
      return;
    }

    const studentData = readStudentBody(request.body);

    if (!studentData) {
      response.status(400).json({
        message: "입력값이 올바르지 않습니다.",
      });
      return;
    }

    await pool.query(
      "UPDATE students SET name = ?, score = ? WHERE id = ?",
      [studentData.name, studentData.score, id]
    );

    const updatedStudent = await findStudentById(id);

    response.json(updatedStudent);
  } catch (error) {
    next(error);
  }
});

app.delete("/students/:id", async function (request, response, next) {
  try {
    const id = isIntegerId(request.params.id);

    if (id === null) {
      response.status(400).json({
        message: "올바른 학생 ID가 아닙니다.",
      });
      return;
    }

    const student = await findStudentById(id);

    if (!student) {
      response.status(404).json({
        message: "학생을 찾을 수 없습니다.",
      });
      return;
    }

    await pool.query(
      "DELETE FROM students WHERE id = ?",
      [id]
    );

    response.json({
      message: "학생이 삭제되었습니다.",
      student: student,
    });
  } catch (error) {
    next(error);
  }
});

app.use(function (request, response) {
  response.status(404).json({
    message: "요청한 API를 찾을 수 없습니다.",
  });
});

app.use(function (error, request, response, next) {
  console.error(error);
  response.status(500).json({
    message: "서버 오류가 발생했습니다.",
  });
});

app.listen(port, function () {
  console.log(`API 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});