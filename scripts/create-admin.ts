import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@tikpay.com';
    const password = 'admin123';

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        console.log(`ℹ️ User with email ${email} already exists. Updating to ADMIN...`);
        const updatedAdmin = await prisma.user.update({
            where: { email },
            data: {
                role: 'ADMIN',
                plan: 'PRO',
            },
        });
        console.log('✅ Admin user updated successfully!');
        console.log('📧 Email:', updatedAdmin.email);
        console.log('👤 Role:', updatedAdmin.role);
        console.log('💳 Plan:', updatedAdmin.plan);
        return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            name: 'TikPay Admin',
            role: 'ADMIN',
            plan: 'PRO',
        },
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password: admin123');
    console.log('👤 Role:', admin.role);
    console.log('💳 Plan:', admin.plan);
}

main()
    .catch((error) => {
        console.error('❌ Error creating admin user:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
