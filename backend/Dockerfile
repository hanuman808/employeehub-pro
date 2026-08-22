# ---------- Stage 1: Build the application with Maven ----------
# Using the Maven+JDK17 image just for building, so it's not part of the final image
FROM maven:3.9.9-eclipse-temurin-17 AS build

# Set working directory inside the build container
WORKDIR /app

# Copy only the pom.xml first (better Docker layer caching:
# dependencies only get re-downloaded if pom.xml actually changes)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Now copy the rest of the source code
COPY src ./src

# Build the jar, skipping tests to keep the image build fast
# (tests should run in CI separately, not on every image build)
RUN mvn clean package -DskipTests

# ---------- Stage 2: Run the application ----------
# Slim JRE-only image for runtime — no Maven, no JDK compiler, much smaller
FROM eclipse-temurin:17-jre-alpine AS runtime

WORKDIR /app

# Copy only the built jar from the build stage — nothing else carries over
COPY --from=build /app/target/*.jar app.jar

# The port Spring Boot listens on (matches server.port=8080 in application.properties)
EXPOSE 8080

# DB_PASSWORD is required at runtime (see application.properties: ${DB_PASSWORD})
# Pass it in with: docker run -e DB_PASSWORD=yourpassword ...
# Never bake the password into the image itself.

ENTRYPOINT ["java", "-jar", "app.jar"]