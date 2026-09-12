Angular production build files are copied into this directory before the Spring Boot JAR is packaged.

For manual deployment:
1. Build Angular with `npm run build`.
2. Copy the generated Angular browser files into this directory.
3. Run `mvn clean package -DskipTests` in `backend`.
4. Deploy the generated JAR to AWS EC2 and run it with `java -jar ...jar`.
