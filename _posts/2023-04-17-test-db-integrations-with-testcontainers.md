---
layout: post
title: "🔥 Test DB integrations with Testcontainers"
date: 2023-04-17 14:00:00 +0100
mood: speechless
description: Write fast, reliable, and isolated tests for your DB integrations with Testcontainers.
tags:
  - tests
  - database
  - tools
  - docker
---

<figure class="aligncenter">
  <img src="https://golang.testcontainers.org/logo.png" alt="Testcontainers logo" />
</figure>

Picture this, you have a critical and reasonably complicated piece of logic in your application that is handled in the database. Despite any change on it (or around it), you must have a 100% guarantee that piece continues to work just fine. So, what do you do?

<!--more-->

### Back in the ancient days...

<figure class="aligncenter">
  <img src="{{ "images/caveofhands.jpeg" | absolute_url }}" alt="Ancient cave art of many hand prints." />
  <figcaption> Ancient cave art of many hand prints. (Credit: Petr Kratochvila/Shutterstock)</figcaption>
</figure>

Before the "age of containers", the solution would be a variant of the following:

1. Have a database with the schema aligned with the application's version.
2. Ensure your CI tool has access to that database, to run the tests in your CI pipeline.
3. Create a script to arrange the necessary data for the test.
4. Write your testing using the DB.
5. Create a script to revert any DB changes performed by the test, such as inserts, updates, etc.
   > [This is](https://avatao.com/blog-life-before-docker-and-beyond/){:target="\_blank"} a very nice post about the Docker: Life Before and after.

##### What's the problem with testing with a shared database?

Simply put, it's complex, expensive to maintain, and has many other reasons to fail. For example:

- The DB's schema version is not the same as the application's version you want to test.
- There is a change in the network policy that blocks access to the database.
- Someone's test setup corrupted the data that you expected to have, so you arrange script fails, or the test fails because of missing data.

Because of the cost and flakiness of such tests, in many cases, the **_solution_** was to move logic from DB to the application's code when performance was not a problem, or just manually test it from time to time and hope it doesn't break because of an unforeseen reason (it-never-happened-in-the-last-30-minutes).

### Containers everywhere

With the popularization of containers, not only developing, runnings, and deploying became easier, but also integrating and testing your external dependencies became easier, faster, and more dependable.

<figure class="aligncenter">
  <img src="{{ "images/containers-everywhere.jpg" | absolute_url }}" alt="Meme Buzzlightier saying to Wood: Containers Everywhere" />
</figure>

We can now effortlessly run not only the regular dependencies, like RDBMSs and Message Brokers, but we can emulate many cloud provider services using tools like [localstack](https://docs.localstack.cloud/overview/){:target="\_blank"}.

#### What about testing? Testcontainers to rescue!

> <a href="https://golang.testcontainers.org/" target="_blank">Testcontainers</a> makes it simple to create and clean up container-based dependencies for automated integration/smoke tests. The clean, easy-to-use API enables developers to programmatically define containers that should be run as part of a test and clean up those resources when the test is done.

It supports many popular languages/frameworks like [Go](https://golang.testcontainers.org/){:target="\_blank"}, [Java](https://testcontainers.org/){:target="\_blank"}, [.NET](https://dotnet.testcontainers.org/){:target="\_blank"}, [Rust](https://docs.rs/testcontainers/latest/testcontainers/){:target="\_blank"}, and others. You can check the full list on its [official](https://www.testcontainers.org/){:target="\_blank"} site](https://www.testcontainers.org/) and because it's open source, you check out and contribute to it in [its repositories](https://github.com/testcontainers){:target="\_blank"}.

#### How to use Testcontainers on integration tests?

For this example, assume that one of the features of your software is to search for users based on a few criteria. Your users are stored in a [PostgreSQL](https://www.postgresql.org/){:target="\_blank"} database and you query them using [SQL](https://en.wikipedia.org/wiki/SQL){:target="\_blank"}. Something like:

```go
func searchPeople(ctx context.Context, db *sql.DB, params searchParams) ([]person, error) {
	query := `select first_name, last_name, city
		 from people
		 where ($1::text is null or first_name = $1)
		   and ($2::text is null or last_name = $2)
		   and ($3::text is null or city = $3)
		 order by first_name asc`

  var people []person

  //Execute query, check errors, populate people variable

  return people, nil
}
```

The search criteria will evolve, by adding new filters or adding new features like pagination. Therefore, we need to make sure that whenever we touch this query its existing behavior is not broken. Let's write a test for it using Testcontainers.

### Writing the test

To be able to run these tests against a real database, we need to:

1. Start the DB
2. Create the schema
3. Arrange data, Act, and Assert

Let's see in detail how to perform each one of these steps.

#### 1. Start the DB

Let's create a function that will start a DB, return its connection string and a function to terminate it when we are done.

```go
func startTestDB(ctx context.Context) (string, func(t *testing.T), error) {
	var envVars = map[string]string{
		"POSTGRES_USER":     "user",
		"POSTGRES_PASSWORD": "super-secret",
		"POSTGRES_DB":       "people",
		"PORT":              "5432/tcp",
	}

	getConnString := func(host string, port nat.Port) string {
		return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
			envVars["POSTGRES_USER"],
			envVars["POSTGRES_PASSWORD"],
			host,
			port.Port(),
			envVars["POSTGRES_DB"])
	}

	req := testcontainers.ContainerRequest{
		Image:        "postgres:14",
		ExposedPorts: []string{envVars["PORT"]},
		Env:          envVars,
		WaitingFor:   wait.ForSQL(nat.Port(envVars["PORT"]), "pgx", getConnString).
      WithStartupTimeout(time.Second * 15),
	}
	pgC, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		return "", nil, fmt.Errorf("failed to start db container :%w", err)
	}
	port, err := pgC.MappedPort(ctx, "5432/tcp")
	if err != nil {
		return "", nil, fmt.Errorf("failed to get mapped port :%w", err)
	}
	host, err := pgC.Host(ctx)
	if err != nil {
		return "", nil, fmt.Errorf("failed to get host :%w", err)
	}

	connString := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		envVars["POSTGRES_USER"],
		envVars["POSTGRES_PASSWORD"],
		host,
		port.Int(),
		envVars["POSTGRES_DB"])

	terminate := func(t *testing.T) {
		if err := pgC.Terminate(ctx); err != nil {
			t.Fatalf("failed to terminate container: %s", err.Error())
		}
	}
	return connString, terminate, nil
}
```

The code above is self-explanatory if you are familiar with Go, but there are a few aspects that I'd like to highlight:

1. Testcontainers will map and assign a random port. Therefore, in this case, instead of connecting to `5432`, it's necessary to connect to the assigned port. This is similar to the `host`name. Therefore, to get your correct connection string it's needed to resolve `port` and `host`.

2. The container will automatically shut down when the application is finished. However, it is recommended to `defer` its termination as soon as it is started. For that, a `terminate` func is returned by the method above.

So far our test looks like this:

```go
func TestSearchPeople(t *testing.T) {
	ctx := context.Background()
	connString, terminate, err := startTestDB(ctx)
	if err != nil {
		t.Error(err)
	}
	defer terminate(t)

	db, err := openDB(connString)
	if err != nil {
		t.Fatal("fail to open DB", err)
	}
	// Continue
}

```

#### 2. Create the schema

With a DB up and running we can initiate it with the expected schema, a.k.a migrate the DB schema.

In the real world, we would use something more sophisticated like [go-migrate](https://github.com/golang-migrate/migrate), but for the sake of simplicity let's write something simpler.

```go
func migrateDB(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, "create table if not exists people (first_name text,last_name text,city text)")
	if err != nil {
		return fmt.Errorf("failed to migrate DB: %w", err)
	}
	return nil
}
```

#### 3. Arrange data, Act, and Assert

The last step before the actual test is to arrange the data. We could accomplish it together with the schema migration, however keeping these two parts separate helps to keep each test isolated, avoiding side effects when the data is tweaked.

For our tests, we need to insert 4 different people with distinct names and cities. Then we can use this data to act and assert the results.
This is what the final test func looks like, testing every variation of our query.

```go
func TestSearchPeople(t *testing.T) {
	ctx := context.Background()
	// Start the DB
	connString, terminate, err := startTestDB(ctx)
	if err != nil {
		t.Error(err)
	}
	// Terminate the container when the func TestSearchPeople finishes
	defer terminate(t)

	// Open the the database
	db, err := openDB(connString)
	if err != nil {
		t.Fatal("fail to open DB", err)
	}

	// Migrate schema
	if err := migrateDB(ctx, db); err != nil {
		t.Fatal("fail to migrate DB", err)
	}

	insert := `insert into people values
			('Flavio', 'Silva', 'Olbia'),
			('Joost', 'Van Huis', 'Amsterdam'),
			('Aldben', 'Arimeritin', 'Istambul'),
			('Nando', 'Pelect', 'Perth');`

    // Arrange data
	if _, err := db.ExecContext(ctx, insert); err != nil {
		t.Fatal("fail to insert initial data", err)
	}

	// Several test cases
	t.Run("without filters", func(t *testing.T) {
		people, err := searchPeople(ctx, db, searchParams{})
		assert.NoError(t, err)
		assert.Equal(t, 4, len(people))
	})

	t.Run("filtering by first name", func(t *testing.T) {
		people, err := searchPeople(ctx, db, searchParams{firstName: strPtr("Joost")})
		assert.NoError(t, err)
		assert.Equal(t, 1, len(people))
		assert.Equal(t, "Joost", people[0].firstName)
	})
	t.Run("filtering by last name", func(t *testing.T) {
		people, err := searchPeople(ctx, db, searchParams{lastName: strPtr("Arimeritin")})
		assert.NoError(t, err)
		assert.Equal(t, 1, len(people))
		assert.Equal(t, "Arimeritin", people[0].lastName)
	})
	t.Run("filtering by city", func(t *testing.T) {
		people, err := searchPeople(ctx, db, searchParams{city: strPtr("Olbia")})
		assert.NoError(t, err)
		assert.Equal(t, 1, len(people))
		assert.Equal(t, "Olbia", people[0].city)
	})
}
```

With this test, we have the guarantee the covered scenarios are working. Profit!

You can check the results by running the tests.

```shell
go test ./... -v
=== RUN   TestSearchPeople
2023/05/09 15:48:55 github.com/testcontainers/testcontainers-go - Connected to docker:
  Server Version: 20.10.22
  API Version: 1.41
  Operating System: Docker Desktop
  Total Memory: 3932 MB
2023/05/09 15:48:55 Starting container id: 95dc2928dae3 image: docker.io/testcontainers/ryuk:0.3.4
2023/05/09 15:48:56 Waiting for container id 95dc2928dae3 image: docker.io/testcontainers/ryuk:0.3.4
2023/05/09 15:48:56 Container is ready id: 95dc2928dae3 image: docker.io/testcontainers/ryuk:0.3.4
2023/05/09 15:48:56 Starting container id: adedca079bc6 image: postgres:14
2023/05/09 15:48:57 Waiting for container id adedca079bc6 image: postgres:14
2023/05/09 15:48:58 Container is ready id: adedca079bc6 image: postgres:14
=== RUN   TestSearchPeople/without_filters
=== RUN   TestSearchPeople/filtering_by_first_name
=== RUN   TestSearchPeople/filtering_by_last_name
=== RUN   TestSearchPeople/filtering_by_city
--- PASS: TestSearchPeople (3.48s)
    --- PASS: TestSearchPeople/without_filters (0.00s)
    --- PASS: TestSearchPeople/filtering_by_first_name (0.00s)
    --- PASS: TestSearchPeople/filtering_by_last_name (0.00s)
    --- PASS: TestSearchPeople/filtering_by_city (0.00s)
PASS
ok  	github.com/flavio1110/go-for-csharp-devs/experiments/test-db-interactions	.724s
```

You can check the source code of this test on my [experiments repository](https://github.com/flavio1110/go-for-csharp-devs/tree/main/experiments/test-db-interactions){:target="\_blank"}.

### Final thoughts

Despite Testcontainers reducing the cost of integration tests and making them more reliable, it doesn't remove the cost entirely. The tests will take more time to run (especially if where you are running the tests doesn't have the image downloaded yet).

Nevertheless, in my opinion, the price is low compared to the benefit that it yields.

What about you? How do you write integration tests, and what are your main challenges?
