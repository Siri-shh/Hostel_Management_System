import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

function verifyToken(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    try { return jwt.verify(authHeader.slice(7), JWT_SECRET); } catch { return null; }
}

function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
    code += '-';
    for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// GET /api/student/groups — get my current group
export async function GET(request) {
    const payload = verifyToken(request);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await prisma.portalGroupMember.findFirst({
        where: { portalStudentId: payload.portalStudentId },
        include: {
            portalGroup: {
                include: {
                    members: { include: { portalStudent: true } },
                    pref1Block: true, pref1RoomType: true,
                    pref2Block: true, pref2RoomType: true,
                }
            }
        }
    });

    if (!membership) return NextResponse.json({ group: null });

    const g = membership.portalGroup;
    return NextResponse.json({
        group: {
            id: g.id,
            inviteCode: g.inviteCode,
            isLeader: g.leaderId === payload.portalStudentId,
            isSubmitted: g.isSubmitted,
            members: g.members.map(m => ({
                id: m.portalStudent.id, name: m.portalStudent.name,
                regNo: m.portalStudent.regNo, year: m.portalStudent.year,
                department: m.portalStudent.department, cgpa: m.portalStudent.cgpa,
                gender: m.portalStudent.gender,
            })),
            avgCgpa: g.members.length > 0
                ? Math.round((g.members.reduce((s, m) => s + m.portalStudent.cgpa, 0) / g.members.length) * 100) / 100
                : null,
            priorityYear: g.members.length > 0 ? Math.min(...g.members.map(m => m.portalStudent.year)) : null,
            pref1: g.pref1Block ? { block: g.pref1Block, roomType: g.pref1RoomType } : null,
            pref2: g.pref2Block ? { block: g.pref2Block, roomType: g.pref2RoomType } : null,
        }
    });
}

// POST /api/student/groups — create a new group
export async function POST(request) {
    const payload = verifyToken(request);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await prisma.allotmentSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.portalStatus !== 'OPEN') {
        return NextResponse.json({ error: 'Portal is not open for applications.' }, { status: 400 });
    }

    const existing = await prisma.portalGroupMember.findFirst({ where: { portalStudentId: payload.portalStudentId } });
    if (existing) return NextResponse.json({ error: 'You are already in a group. Leave it first.' }, { status: 409 });

    let inviteCode;
    let attempts = 0;
    do {
        inviteCode = generateInviteCode();
        const taken = await prisma.portalGroup.findUnique({ where: { inviteCode } });
        if (!taken) break;
        attempts++;
    } while (attempts < 10);

    const group = await prisma.portalGroup.create({
        data: {
            sessionId: payload.sessionId,
            inviteCode,
            leaderId: payload.portalStudentId,
            members: { create: { portalStudentId: payload.portalStudentId } },
        },
    });

    return NextResponse.json({ message: 'Group created!', inviteCode: group.inviteCode, groupId: group.id });
}
